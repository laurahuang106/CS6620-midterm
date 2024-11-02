import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DynamoDBStack extends Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: cdk.App, id: string, props?: StackProps) {
    super(scope, id, props);

    // Define DynamoDB Table
    this.table = new dynamodb.Table(this, 'BackupStorageTable', {
      tableName: 'BackupStorageTable',
      partitionKey: { name: 'ObjectID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'CopyID', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Define GSI for Disowned Objects
    this.table.addGlobalSecondaryIndex({
      indexName: 'DisownIndex',
      partitionKey: { name: 'DisownStatus', type: dynamodb.AttributeType.BINARY },
      sortKey: { name: 'DisownTimestamp', type: dynamodb.AttributeType.NUMBER },
      projectionType: dynamodb.ProjectionType.ALL,
    });
  }
}
