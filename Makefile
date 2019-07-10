
up: simplelambda.zip
	pulumi up

simplelambda.zip: simplelambda.js
	zip simplelambda.zip simplelambda.js

down: 
	pulumi destroy

out:
	pulumi stack output

access-test:
	aws --profile pulumitargetacct s3 ls
