import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';  // Import the S3 Notifications module

export interface StorageStackProps extends StackProps {
  replicatorFunction?: lambda.IFunction;
}

export class StorageStack extends Stack {
  public readonly srcBucket: s3.Bucket;
  public readonly dstBucket: s3.Bucket;
  public readonly table: dynamodb.Table;

  constructor(scope: cdk.App, id: string, props?: StorageStackProps) {
    super(scope, id, props);

    // Define Source Bucket
    this.srcBucket = new s3.Bucket(this, 'SourceBucket', {
      bucketName: 'laura-source-bucket-24midterm',
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Define Destination Bucket
    this.dstBucket = new s3.Bucket(this, 'DestinationBucket', {
      bucketName: 'laura-destination-bucket-24midterm',
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Define DynamoDB Table
    this.table = new dynamodb.Table(this, 'BackupStorageTable', {
      tableName: 'BackupStorageTable',
      partitionKey: { name: 'ObjectID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'CopyID', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // Define GSI for Disowned Objects
    this.table.addGlobalSecondaryIndex({
      indexName: 'DisownIndex',
      partitionKey: { name: 'DisownStatus', type: dynamodb.AttributeType.BINARY },
      sortKey: { name: 'DisownTimestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // Add Event Notification if the replicatorFunction is provided
    if (props?.replicatorFunction) {
      this.srcBucket.addEventNotification(
        s3.EventType.OBJECT_CREATED_PUT,
        new s3n.LambdaDestination(props.replicatorFunction)
      );
      this.srcBucket.addEventNotification(
        s3.EventType.OBJECT_REMOVED_DELETE,
        new s3n.LambdaDestination(props.replicatorFunction)
      );
    }
  }
}
