import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import path = require('path');

export interface CleanerLambdaStackProps extends StackProps {
  dstBucket: s3.Bucket;
  table: dynamodb.Table;
}

export class CleanerLambdaStack extends Stack {
  constructor(scope: cdk.App, id: string, props: CleanerLambdaStackProps) {
    super(scope, id, props);

    const cleanerFunction = new lambda.Function(this, 'CleanerLambda', {
      functionName: 'CleanerLambda',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'cleaner_lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      timeout: cdk.Duration.seconds(15),
      environment: {
        DST_BUCKET_NAME: props.dstBucket.bucketName,
        TABLE_NAME: props.table.tableName,
      }
    });

    // Grant the necessary permissions to the Lambda
    props.dstBucket.grantDelete(cleanerFunction);
    props.table.grantReadWriteData(cleanerFunction);

    // Set up a CloudWatch Event to trigger every 1 minute
    const rule = new events.Rule(this, 'CleanerSchedule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1))
    });
    rule.addTarget(new targets.LambdaFunction(cleanerFunction));
  }
}
