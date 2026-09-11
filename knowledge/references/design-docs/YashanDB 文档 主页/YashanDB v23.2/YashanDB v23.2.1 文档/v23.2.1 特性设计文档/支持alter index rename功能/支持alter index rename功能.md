Created by 郑翌恺, last modified on 十二月 28, 2023

YDBRD-22965 : 支持alter index rename功能（22.2 单机）

YDBRD-24926 : 支持alter index rename功能（23.1 单机、分布式、集群）

YDBRD-23252 : 支持alter index rename功能（23.2 单机、分布式、集群）

链接：

  [[YDBRD-22965] 支持alter index rename功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22965)  

  [[YDBRD-24926] 支持alter index rename功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-24926)  

  [[YDBRD-23252] 支持alter index rename功能 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-23252)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

支持alter index rename功能，其中22.2只支持单机，23.1和23.2支持单机、分布式和集群

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|  `alter index old_name `      `rename`         `to new_name;`  |
|:---|


  [  
3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**指定的新的索引名称不能为空且必须符合对象命名规范，新名称不能已被其他索引使用**

**修改的系统表：obj$**

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

### 4.1 单机

1 数据结构

|  `typedef`         `struct`         `StAlterIndexDef {`      
    `    `      `AlterIndexAction action;`      
    `    `      `LangText  indexOwnerName;`      
    `    `      `LangText  indexName;`      
    `    `      `LangText  partName;`      
    `    `      `LangText  newIndexName;    `      `//新增newIndexName`      
    `    `      `CodUint64 objectId;`      
    `    `      `CodUint64 tabVersion;`      
    `    `      `CodUint64 clauses;`      
    `    `      `CodUint16 parallel;`      
    `    `      `CodBool   isSub;`      
    `    `      `union`         `{`      
    `        `      `CodUint8 isInvisible;`      
    `        `      `CodUint8 isUnusable;`      
    `        `      `CodUint8 iniTrans;`      
    `        `      `RebuildIndexParam rebuildParam;`      
    `        `      `List*             reclaimSegDef;`      
    `    `      `};`      
    `} AlterIndexDef;`  |
|:---|


2 函数接口

|name|Meaning|
|:---|:---|
|parseAlterIndexRename|判断rename和新名称是否符合语法，初始化def->newIndexName|
|indexRename|判断新名称是否存在，更新索引名称|


3 详细设计

1. AlterIndexAction增加ALTER_INDEX_RENAME
1. parser阶段识别到ANL_TOKEN_RENAME后，进入parseAlterIndexRename，判断rename后是否附带to，判断输入的新索引名称是否符合命名规范，都符合将新索引名称加载到def->newIndexName
1. indexRename调用codTextEqual判断是否出现了oldname = newname的情况，再调用  objUpdateName更新obj$表（将错误码唯一约束重定向为obj已存在）
1. 日志：alter index调用的是alter table日志，不需要修改


### 4.2 分布式

在execAlterIndexEntry函数处增加def→action = rename的判断条件，如果行为是rename，根据newIndexName打开table，如果不是，根据IndexName打开table

### 4.3 集群

无额外修改

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|  `drop table `      `if`         `exists ddl_index_rename_table;`      
    `create table ddl_index_rename_table(a `      `int`      `);`      
    `create index ddl_index_rename1 on ddl_index_rename_table(a);`      
    `select OWNER, INDEX_NAME, INDEX_TYPE, TABLE_OWNER, TABLE_NAME, TABLE_TYPE FROM DBA_INDEXES WHERE INDEX_NAME = `      `'DDL_INDEX_RENAME1'`      `;`      
    `alter index ddl_index_rename1 `      `rename`         `ddl_index_rename2;      //rename不带to，错误解析`      
    `alter index ddl_index_rename1 `      `rename`         `to ddl_index_rename1;   //rename旧索引名称，会报错obj已存在`      
    `alter index ddl_index_rename1 `      `rename`         `to ddl_index_rename2;   //rename已存在索引名称，会报错obj已存在`      
    `select OWNER, INDEX_NAME, INDEX_TYPE, TABLE_OWNER, TABLE_NAME, TABLE_TYPE FROM DBA_INDEXES WHERE INDEX_NAME = `      `'DDL_INDEX_RENAME1'`      `;`      
    `select OWNER, INDEX_NAME, INDEX_TYPE, TABLE_OWNER, TABLE_NAME, TABLE_TYPE FROM DBA_INDEXES WHERE INDEX_NAME = `      `'DDL_INDEX_RENAME2'`      `;`      
    `drop table `      `if`         `exists ddl_index_rename_table;`  |
|:---|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

增加ALTER     [INDEX.md](http://INDEX.md)    中对RENAME TO的描述