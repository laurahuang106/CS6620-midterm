import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
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

    // Step Function Task to invoke the Cleaner Lambda
    const invokeCleanerTask = new tasks.LambdaInvoke(this, 'Invoke Cleaner Lambda', {
      lambdaFunction: cleanerFunction,
      outputPath: '$.Payload',
    });

    // Step Function Wait Task to wait for 5 seconds
    const waitTask = new stepfunctions.Wait(this, 'Wait 5 Seconds', {
      time: stepfunctions.WaitTime.duration(cdk.Duration.seconds(5)),
    });

    // Define a Success State as a terminal state
    const successState = new stepfunctions.Succeed(this, 'Success');

    // Define a Choice State to continue or stop the loop
    const choiceState = new stepfunctions.Choice(this, 'Check Loop Condition')
      .when(stepfunctions.Condition.booleanEquals('$.continue', true), waitTask)
      .otherwise(successState);

    // Chain the tasks: invoke -> wait -> choice -> (loop or end)
    const definition = invokeCleanerTask
      .next(waitTask)
      .next(choiceState);

    // Create the State Machine
    const stateMachine = new stepfunctions.StateMachine(this, 'CleanerStateMachine', {
      definition,
      timeout: cdk.Duration.hours(1),  // Set a max timeout for the state machine
    });

    // Grant permission to Cleaner Lambda to be invoked by the State Machine
    cleanerFunction.grantInvoke(new iam.ServicePrincipal('states.amazonaws.com'));
  }
}
