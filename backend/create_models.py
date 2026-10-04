#!/usr/bin/env python3
"""
Creates the request/response models from models.json in an API Gateway REST API and
attaches them to each method (request body model, response models per status code,
and an optional Authorization header on protected methods) so the exported
OpenAPI/Swagger file is complete.

Run it in AWS CloudShell (boto3 is already installed there):

  python3 create_models.py --api-id 6liafal0f3 --dry-run     # show the plan, change nothing
  python3 create_models.py --api-id 6liafal0f3               # create models and attach them
  python3 create_models.py --api-id 6liafal0f3 --deploy      # ...and deploy to the stage

Safe to re-run: existing models are updated, and method responses are recreated.
Not handled here (do these in the console if you want them): query string parameters
and request validators.
"""
import argparse
import json
import pathlib
import sys

MODELS_FILE = pathlib.Path(__file__).with_name("models.json")
DRAFT4 = "http://json-schema.org/draft-04/schema#"
ERR = "ErrorResponse"

# (path, method, request model or None, protected?, {status code: response model})
# Edit the paths here if yours differ. Paths not found in the API are skipped with a warning.
METHODS = [
    ("/getCourses", "GET", None, False, {"200": "GetCoursesResponse", "400": ERR}),
    ("/getClassrooms", "GET", None, False, {"200": "GetClassroomsResponse", "400": ERR}),
    ("/getTeachers", "GET", None, False, {"200": "GetTeachersResponse", "400": ERR}),
    ("/getClasses", "GET", None, False, {"200": "GetClassesResponse", "400": ERR}),
    ("/getClassAvailability/{class_id}", "GET", None, False,
     {"200": "GetClassAvailabilityResponse", "400": ERR, "404": ERR, "409": ERR}),

    ("/signup", "POST", "SignupRequest", False,
     {"201": "SignupResponse", "400": ERR, "409": ERR}),
    ("/login", "POST", "LoginRequest", False,
     {"200": "LoginResponse", "400": ERR, "401": ERR, "403": ERR}),

    ("/pendingSignups", "GET", None, True,
     {"200": "PendingSignupsResponse", "401": ERR, "403": ERR}),
    ("/reviewSignup", "POST", "ReviewSignupRequest", True,
     {"200": "UserResponse", "400": ERR, "401": ERR, "403": ERR, "409": ERR}),
    ("/addTeacher", "POST", "NewUserRequest", True,
     {"201": "UserResponse", "400": ERR, "401": ERR, "403": ERR, "409": ERR}),
    ("/addStudent", "POST", "NewUserRequest", True,
     {"201": "UserResponse", "400": ERR, "401": ERR, "403": ERR, "409": ERR}),
    ("/addClassroom", "POST", "AddClassroomRequest", True,
     {"201": "ClassroomResponse", "400": ERR, "401": ERR, "403": ERR, "409": ERR}),
    ("/addCourse", "POST", "AddCourseRequest", True,
     {"201": "CourseResponse", "400": ERR, "401": ERR, "403": ERR}),
    ("/book", "POST", "BookRequest", True,
     {"201": "BookResponse", "400": ERR, "401": ERR, "403": ERR, "404": ERR, "409": ERR}),
]

JSON_KEY = "application~1json"  # "application/json" escaped for a patch path ("/" becomes "~1")
AUTH_PARAM = "method.request.header.Authorization"


def full_schema(name, body):
    return json.dumps({"$schema": DRAFT4, "title": name, **body})


def upsert_model(client, ClientError, api_id, name, body):
    schema = full_schema(name, body)
    try:
        client.create_model(restApiId=api_id, name=name, contentType="application/json",
                            description=name, schema=schema)
        print(f"  created model {name}")
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConflictException":
            raise
        client.update_model(restApiId=api_id, modelName=name,
                            patchOperations=[{"op": "replace", "path": "/schema", "value": schema}])
        print(f"  updated model {name}")


def attach(client, api_id, resources, path, method, req_model, protected, responses):
    res = resources.get(path)
    if res is None:
        print(f"  SKIP {method} {path}: path not found in this API")
        return
    if method not in res.get("resourceMethods", {}):
        print(f"  SKIP {method} {path}: method not found on that path")
        return
    rid = res["id"]
    current = client.get_method(restApiId=api_id, resourceId=rid, httpMethod=method)

    patches = []
    if req_model:
        op = "replace" if "application/json" in current.get("requestModels", {}) else "add"
        patches.append({"op": op, "path": f"/requestModels/{JSON_KEY}", "value": req_model})
    if protected:
        op = "replace" if AUTH_PARAM in current.get("requestParameters", {}) else "add"
        patches.append({"op": op, "path": f"/requestParameters/{AUTH_PARAM}", "value": "false"})
    if patches:
        client.update_method(restApiId=api_id, resourceId=rid, httpMethod=method,
                             patchOperations=patches)

    # Recreate method responses so exactly the listed status codes exist
    for code in current.get("methodResponses", {}):
        client.delete_method_response(restApiId=api_id, resourceId=rid, httpMethod=method,
                                      statusCode=code)
    for code, model in responses.items():
        client.put_method_response(restApiId=api_id, resourceId=rid, httpMethod=method,
                                   statusCode=code, responseModels={"application/json": model})
    print(f"  attached {method} {path}: request={req_model or '-'} responses={','.join(responses)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api-id", required=True, help="REST API id (the part before .execute-api in your URL)")
    ap.add_argument("--region", default="us-east-2")
    ap.add_argument("--stage", default="Development")
    ap.add_argument("--dry-run", action="store_true", help="print the plan and change nothing")
    ap.add_argument("--deploy", action="store_true", help="deploy to the stage when finished")
    args = ap.parse_args()

    models = json.loads(MODELS_FILE.read_text())
    used = {m for _, _, r, _, resp in METHODS for m in ([r] if r else []) + list(resp.values())}
    missing = used - set(models)
    if missing:
        sys.exit(f"models.json is missing: {', '.join(sorted(missing))}")

    if args.dry_run:
        print(f"DRY RUN against API {args.api_id} ({args.region}); nothing will be changed.\n")
        print(f"Models to create or update ({len(models)}):")
        for name in models:
            print(f"  {name}")
        print("\nMethods to update:")
        for path, method, req, protected, responses in METHODS:
            print(f"  {method:4} {path}  request={req or '-'}  "
                  f"Authorization header={'yes' if protected else 'no'}  responses={responses}")
        return

    import boto3
    from botocore.exceptions import ClientError

    client = boto3.client("apigateway", region_name=args.region)

    print("Creating or updating models...")
    for name, body in models.items():
        upsert_model(client, ClientError, args.api_id, name, body)

    print("\nAttaching models to methods...")
    items = client.get_resources(restApiId=args.api_id, limit=500, embed=["methods"])["items"]
    resources = {r["path"]: r for r in items}
    for path, method, req, protected, responses in METHODS:
        attach(client, args.api_id, resources, path, method, req, protected, responses)

    if args.deploy:
        client.create_deployment(restApiId=args.api_id, stageName=args.stage,
                                 description="Add request/response models")
        print(f"\nDeployed to stage {args.stage}.")
    else:
        print("\nDone. Deploy the API (Deploy API in the console, or re-run with --deploy) "
              "for the changes to go live.")


if __name__ == "__main__":
    main()
