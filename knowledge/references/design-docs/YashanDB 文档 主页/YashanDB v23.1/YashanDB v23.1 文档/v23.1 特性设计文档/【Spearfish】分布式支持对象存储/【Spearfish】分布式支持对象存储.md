Created by 黄子迅, last modified on 二月 21, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview概述)  

LSC单机支持对象存储：    [【Spearfish】LSC表支持对象存储](112726601.html)  

本特性在单机基础上，完善分布式对对象存储的支持。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features功能特性)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

1，create tablespace set支持创建databucket。

2，alter tablespace set支持创建，删除，alter  databucket。

3，drop tablespace set支持同时清除databucket。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

参见下述DDL语法。

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

同单机。

分布式和单机下的databucket路径都改为需要限定必需使用相对路径即可，路径不存在即自动创建。

新增_enabLE_S3配置项，默认不配置无法操作s3 bucket。

  


分布式下tablespace内不可创建s3 bucket。

用户指定创建的databucket名字不可与内置默认创建的bucket名字相同，例如不可同时包含'TSS'和'CHUNK'，或不可同时包含'TSS'、’ROOT'、'DATABUCKET'。

内置桶对用户不可见，所以用户也不能指定修改内置桶。

  


databucket只与tablespace关联，查询tablespace set的databucket需通过关联tablespace。

  


drop tablespace set时不加including contents会报错。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

  


**1， create语法调整**

![](https://pingcode.yasdb.com/atlas/files/public/67396b018970c2af4f520098/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)

增加databucket_clause，该部分语法同单机。

创建tablespace set时首先会在每个节点上默认创建default tablespace，且会默认在该空间下挂载命名为 'TSS_Oid_ROOT_DATABUCKET' 的databucket；

且不论用户指定了databucket与否，都会默认在每个CHUNK下新建一个命名为 'TSS_Oid_CHUNK_chunkId' 的databucket。

上述bucket都为默认创建的内置桶，对用户均不可见也不能修改。

  


若用户指定了databucket：

- CN、MN下在default tablepsace内创建databucket，名字即为用户输入的名字，用来记录进系统表用，不写入实际数据；
- DN在chunk space下创建databucket，命名为 'bucket_name_TSS_Oid_CHUNK_chunId'，用来实际写入数据。


  


**2， alter语法调整**

![](https://pingcode.yasdb.com/atlas/files/public/67396b018970c2af4f520099/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)

增加data bucket clause。

![](https://conf.yasdb.com/download/attachments/112726601/image2023-6-29_15-44-14.png?version=1&modificationDate=1688024602000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)

ADD：

- CN、MN下接着在default tablepsace内创建databucket，名字即为用户输入的名字；
- DN接着在chunk space下创建databucket，命名为 'bucket_name_TSS_Oid_CHUNK_chunId'。


  


bucket_clause = "'bucket_name'" [s3_bucket_clause] [MAXSIZE size_clause].

![](https://conf.yasdb.com/download/attachments/112726601/image2023-7-4_15-14-30.png?version=1&modificationDate=1688454810000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)

size可以是字节数，也可以是unlimited。

'bucket_name'既可以只写databucket实际名称，也可以带上相对路径，只要不以'/'开头或结尾就行。

- ?开头表示相对DB_HOME的路径，若路径不存在即自动创建；
- 如果直接使用名称则databucket会被放置在DB_HOME/local_fs下。


例如：CREATE TABLESPACE SET tss1 DATABUCKET '?/ABC/tss1_bucket1' ON users MAXSIZE 8G;

实际生成的对象路径是： DB_HOME/ABC/tss1_bucket1。

  


s3_bucket_clause = S3 "(" URL "'url'" ["," REGION "'region'"] "," ACCESS KEY "'ak'" "," SECRET KEY "'sk'" ")".

![](https://conf.yasdb.com/download/attachments/112726601/image2023-6-14_18-0-23.png?version=1&modificationDate=1686736823000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)

URL最大1023字节，AK最大127字节，SK最大127字节，region最大127字节， region可省略。

URL中包含s3 bucket名称，最大127字节。

例如： CREATE TABLESPACE SET s3_tablespace_set DATABUCKET 's3_bucket' S3(url '192.168.7.202:8000/testbucket',access key 'mos',secret key 'mos') ON users MAXSIZE 8G;

  


注意这里URL仅支持path-style，且必须对应于S3的某个bucket，而不能是一个prefix。

实际生成的对象路径是： url/tablespaceName/dataOid/sliceFileId。

  


**3，drop tablespace set INCLUDING CONTENTS时自动删除data bucket。**

不加including contents会报错，不允许删除表空间集。

在桶中的文件尚未完成归档清理的情况下，databucket如无法删除需报错，不可在归档下直接残留文件。

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

#### DataBucket系统表

```
CREATE TABLE DATABUCKET$

(

TS# BINARY_INTEGER NOT NULL,

NAME VARCHAR(128) NOT NULL,

USED_SIZE BINARY_BIGINT NOT NULL,

MAX_SIZE BINARY_BIGINT NOT NULL,

URL VARCHAR(1024) NOT NULL,

REGION VARCHAR(128),

ACCOUNT VARCHAR(128),

PASSWORD VARCHAR(128),

READONLY BOOLEAN NOT NULL

)SYSTEM 164 ORGANIZATION HEAP

/

CREATE UNIQUE INDEX I_DATABUCKET ON DATABUCKET$$(TS#, NAME)
```

1，升级时已创建的bucket不在该系统表中，系统保持兼容性。

2，user表空间默认创建的bucket不在该系统表中。即表空间仍然作为版本0创建。

3，default tablespace下每次创建表空间集时自动创建的根bucket不会被记录进系统表。

4，创建表空间集时每个chunk下自动创建的本地bucket不会被记录进系统表。

5，name在整个节点上所有表空间集和表空间的范围内都是唯一的，但S3 bucket的名字由于在url下自动创建了目录，可以使用同名bucket。

**SpaceSetDef：**  tablespace set的结构体

```
typedef struct StSpaceSetDef {
    CodUint64 oid;
    LangText  name;
    LangText  dsName;
    CodUint64 size;
    CodUint64 maxSize;
    CodUint64 nextSize;
    CodUint64 spaceMaxBlocks;
    CodUint64 dsId;
    CodUint32 blockSize;
    CodUint32 globalChunkCount;
    CodUint32 spaceDatafileCount;
    CodUint32 lastFileMaxBlocks;
    List*     localChunkIds;
    CodBool   encrypted;
    CodUint8  encAlgo;
    CodBool   memMapped;
    CodBool   isCreateDefault;
    CodBool   hasSetDataBucket;
    CodBool   isSet;
    CodUint8  unused[4];
} SpaceSetDef;
```

加了布尔变量hasSetDataBucket来区分创建表空间集时用户是否指定了databucket名称的情况；加了布尔变量isSet来区分创建是否在是分布式下创建tablespace的databucket。

**AlterSpaceSetDef：**  alter tablespace set的结构体

```
typedef struct StAlterSpaceSetDef {
    CodUint64         oid;
    LangText          name;
    CodUint64         size;
    AnkAlterTssAction action;
    CodUint64         maxSize;
    CodUint64         nextSize;
    CodUint32         blockSize;
    CodUint32         datafileCount;
    List*             chunkIds;
    CodUint64         version;
    union {
        List*            addBuckets;
        LangText         dropBucket;
        AlterBucketDef   alterBucket;
    };
} AlterSpaceSetDef;
```

增加了一个bucket相关的union，分别对应修改表空间集新增、删除、修改bucket的情况。

流程图：

CREATE TABLESPACE SET

1，先在每个节点都生成一个default tablespace并生成root-databucket用来存放根表，命名为  TSS_oid_  ROOT_DATABUCKET。

![](https://conf.yasdb.com/download/attachments/122076753/image2023-7-31_14-44-12.png?version=1&modificationDate=1691065879000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)

2，创建set时用户如果指定了bucket，在MN、CN的default tablespace下挂载DN下实际要存放数据的databucket的原名bucket，不存放数据只用来逻辑上记录bucket的名字并记录进系统表里，使用户在CN上操纵表空间集时可以“看见”指定创建的databucket。

2，在DN上生成每个chunk下的databucket用来存放实际数据。

1. 创建set时如果用户未指定bucket名称，则默认在每个chunk下创建一个本地bucket，但不会被挂进MN和CN的default tablespace下，这种bucket对用户不可见，故和root-bucket一样不会被记录进系统表里，也不能被操作  ；
1. ![](https://conf.yasdb.com/download/attachments/122076753/image2023-7-31_15-51-59.png?version=1&modificationDate=1691065879000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUNBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFDQUFBQ0FBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTA1NzcsImV4cCI6MTc4MjMwMTM3N30.4XJtdknqZzVeCh9VH98o9_oO0pEiUMAjDi5CDWZ60N4)
1. 创建set时用户如果指定了bucket名称，则不生成本地默认的bucket，而在每个chunk下按照指定的名称和类型生成bucket，并在MN和CN的default tablespace下生成不加后缀的bukcet，本地生成该bucket空目录，同时将该bucket记录进CN的系统表里  。
1. 


  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## Attachments:

[image2023-7-17_17-25-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDA4OTcwYzJhZjRmNTIwMDhlIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.7wTLcnHytstXd7vks8thJseCMWmjr5Ef3soYaaDOEcc)

 (image/png)    


[image2023-6-29_15-44-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDBhMWFkOWEzMzExZGM3ZjA1IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.I-cOzYtRKkYoDClN5l0pgq2raujP73Jkyz1Xubtlb3s)

 (image/png)    


[image2023-7-17_17-22-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDA4OTcwYzJhZjRmNTIwMDkwIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.3E14sx2Cak5CZmcb1FJvTW2Vb8OlVRNHMpm5DkYqcuw)

 (image/png)    


[image2023-7-17_17-22-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDA4OTcwYzJhZjRmNTIwMDkxIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.XXtrWCwHfw0hjErzwSbv8kZBzz7oDaNQyY7Aqebh4j8)

 (image/png)    


[image2023-7-17_17-13-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDE4OTcwYzJhZjRmNTIwMDkyIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.oMTQ760P8h7KH57jwcg9-eW-FDbetyIgRcfNcmuJSRk)

 (image/png)    


[image2023-7-4_15-14-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjA2IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.A2S_cHp1Ej1kW1GYgiTZprhf0gkWd809gyOuVM__8hY)

 (image/png)    


[image2023-6-14_18-0-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjA3IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.yKOPE8o1h3NaLi1Mr49CQ6IaCU-reeQn4PoDSGyWmDE)

 (image/png)    


[image2023-7-31_14-39-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjA4IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.qq1I69tB_AB8yB07ptLVtbX7ISiL2TMhbOYs7pVrAlw)

 (image/png)    


[image2023-7-31_14-44-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjA5IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.L6lghTA3kdTxwOjeKene8BKpGo-2wXZmkyYL6xMQJl0)

 (image/png)    


[image2023-7-31_15-38-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDE4OTcwYzJhZjRmNTIwMDkzIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.JwWnzFi2shDvCrLnnfmgp_OW_lkFYc1A1Ig1VCtv_KI)

 (image/png)    


[image2023-7-31_15-41-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjBhIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.-w6SNFH6uCYRjv0Ls6DG7yFQ01suUS3l-jm_efdYH9U)

 (image/png)    


[image2023-7-31_15-47-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDE4OTcwYzJhZjRmNTIwMDk0IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.3vtAdDE2otXAL7Ra67wWI_XbjkYfqawi4r00RcEhE8o)

 (image/png)    


[image2023-7-31_15-47-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjBiIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.UsXbmtSl1qoRuRg5zk1n9ZHhB7yxAGpG-s4UHgS96yw)

 (image/png)    


[image2023-7-31_15-51-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjBkIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.d0TIMaKtEdqtHC8XBfjIsm7QifS7qpbTkFFzARfSMKs)

 (image/png)    


[image2023-7-31_15-52-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDE4OTcwYzJhZjRmNTIwMDk1IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.-Ltp93xKZpz3gQ0m0pGFQWEfr1gH66hrmQnZ3jq6TzA)

 (image/png)    


[image2023-8-7_14-39-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDE4OTcwYzJhZjRmNTIwMDk2IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.cHRy2mj_x7sc6l0EthgqC4nDETib6NBEcdJ4AXWvFaY)

 (image/png)    


[image2024-2-21_19-57-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDE4OTcwYzJhZjRmNTIwMDk3IiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.8dCHsML3NVwJOpv3yqrvVv5HwwnKjYF-Fmrq85LZ2oc)

 (image/png)    


[image2024-2-21_20-6-2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiMDFhMWFkOWEzMzExZGM3ZjBmIiwicmVmX2lkIjoiNjczOTZiMDA1OTNmOTljOWZmMjM1YzUwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwNTc3LCJleHAiOjE3ODIzNzY5Nzd9.HhI57ANHbgwNDNORzzHGCr61DheXUrkOKLjX0FXph-E)

 (image/png)    


## Comments:

|  [](null)  ,讨论纪要：,1，分布式下data bucket不支持绝对路径,2，memory map的tablespace set是否支持创建 data bucket,逻辑上应该不加以限制？,3，节点故障导致语句执行失败，需做相应的故障处理,4， 仍然保留默认创建的data bucket。,  
,Posted by xierui at 七月 18, 2023 15:34|
|---|
|  [](null)  ,评审意见：,1，分布式下tablespace内不可创建s3 bucket,2，tablespace set内默认data bucket需要创建，且最低优先级使用。,3，CN。MN下在default tablepsace内创建databucket，DN在chunk space下创建databucket,4，databucket只与tablespace关联，查询tablespace set的data bucket需通过关联tablespace。,5，databucket如无法删除需报错，不可在归档下直接残留文件。,Posted by xierui at 八月 04, 2023 16:35|
