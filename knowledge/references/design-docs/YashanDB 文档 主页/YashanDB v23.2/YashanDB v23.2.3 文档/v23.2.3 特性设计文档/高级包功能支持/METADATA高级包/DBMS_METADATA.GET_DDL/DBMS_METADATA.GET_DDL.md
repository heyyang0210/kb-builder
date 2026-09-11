Created by 冯皓博 on 十月 27, 2022

## 1、Overview(概述)

支持DBMS_METADATA.GET_DDL功能

原始需求：    [YDBRD-4796](https://jira.yasdb.com/browse/YDBRD-4796?src=confmacro)    -  【2022.2】支持DBMS_METADATA.GET_DDL系统包功能  完成

## 2、Features（功能特性）

  


```
DBMS_METADATA.GET_DDL (
object_type     IN VARCHAR2,
name            IN VARCHAR2,
schema          IN VARCHAR2 DEFAULT NULL,
version         IN VARCHAR2 DEFAULT 'COMPATIBLE',
model           IN VARCHAR2 DEFAULT 'ORACLE',
transform       IN VARCHAR2 DEFAULT 'DDL')
RETURN CLOB;
```

  


|object_type|是否需要支持|优先级|
|---|---|---|
|AQ_QUEUE|  
|  
|
|AQ_QUEUE_TABLE|  
|  
|
|AQ_TRANSFORM|  
|  
|
|ASSOCIATION|  
|  
|
|AUDIT|  
|  
|
|AUDIT_OBJ|  
|  
|
|CLUSTER|  
|  
|
|COMMENT|  
|  
|
|CONSTRAINT|  
|  
|
|CONTEXT|  
|  
|
|DATABASE_EXPORT|  
|  
|
|DB_LINK|  
|  
|
|DEFAULT_ROLE|  
|  
|
|DIMENSION|  
|  
|
|DIRECTORY|  
|  
|
|FGA_POLICY|  
|  
|
|FUNCTION|  
|2|
|INDEX_STATISTICS|  
|  
|
|INDEX|  
|1|
|INDEXTYPE|  
|  
|
|JAVA_SOURCE|  
|  
|
|JOB|  
|  
|
|LIBRARY|  
|  
|
|MATERIALIZED_VIEW|  
|  
|
|MATERIALIZED_VIEW_LOG|  
|  
|
|OBJECT_GRANT|  
|  
|
|OPERATOR|  
|  
|
|PACKAGE|  
|2|
|PACKAGE_SPEC|  
|  
|
|PACKAGE_BODY|  
|  
|
|PROCEDURE|  
|  
|
|PROFILE|  
|  
|
|PROXY|  
|  
|
|REF_CONSTRAINT|  
|  
|
|REFRESH_GROUP|  
|  
|
|RESOURCE_COST|  
|  
|
|RLS_CONTEXT|  
|  
|
|RLS_GROUP|  
|  
|
|RLS_POLICY|  
|  
|
|RMGR_CONSUMER_GROUP|  
|  
|
|RMGR_INTITIAL_CONSUMER_GROUP|  
|  
|
|RMGR_PLAN|  
|  
|
|RMGR_PLAN_DIRECTIVE|  
|  
|
|ROLE|  
|  
|
|ROLE_GRANT|  
|  
|
|ROLLBACK_SEGMENT|  
|  
|
|SCHEMA_EXPORT|  
|  
|
|SEQUENCE|  
|1|
|SYNONYM|  
|2|
|SYSTEM_GRANT|  
|  
|
|TABLE|  
|1|
|TABLE_DATA|  
|  
|
|TABLE_EXPORT|  
|  
|
|TABLE_STATISTICS|  
|  
|
|TABLESPACE|  
|  
|
|TABLESPACE_QUOTA|  
|  
|
|TRANSPORTABLE_EXPORT|  
|  
|
|TRIGGER|  
|2|
|TRUSTED_DB_LINK|  
|  
|
|TYPE|  
|  
|
|TYPE_SPEC|  
|  
|
|TYPE_BODY|  
|  
|
|USER|  
|1|
|VIEW|  
|1|
|XMLSCHEMA|  
|  
|
|XS_USER|  
|  
|
|XS_ROLE|  
|  
|
|XS_ROLESET|  
|  
|
|XS_ROLE_GRANT|  
|  
|
|XS_SECURITY_CLASS|  
|  
|
|XS_DATA_SECURITY|  
|  
|
|XS_ACL|  
|  
|
|XS_ACL_PARAM|  
|  
|
|XS_NAMESPACE|  
|  
|
|  
|  
|  
|


## 3、Interfaces（接口）

## 4、Limitations（功能限制）

## 5、Detail Design（详细设计）

**5.1 VIEW**

- 系统表：view$,取text字段


**5.2TABLE**

## 6、Testcases（自测用例）

## 7、Documents（资料）

## 8、Wordload（工作量）

## 9、TODO（遗留问题）