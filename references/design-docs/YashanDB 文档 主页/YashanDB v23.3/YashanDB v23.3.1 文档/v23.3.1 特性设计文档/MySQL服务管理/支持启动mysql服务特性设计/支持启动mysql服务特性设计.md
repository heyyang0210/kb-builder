Created by 张鹏飞, last modified on 四月 29, 2024

  [https://pingcode.yasdb.com/pjm/items/6618efd0fd997db58ad848db](https://pingcode.yasdb.com/pjm/items/6618efd0fd997db58ad848db)    ?    
  #YDBRD-26191 支持启动mysql服务

##   [1. 总述](#1-总述)  

本需求主要解决MySQL兼容的框架问题。

###   [1.1 需求来源](#11-需求来源)  

  [](https://conf.yasdb.com/pages/viewpage.action?pageId=150625724&src=contextnavpagetreemode)  

具体范围为：

  [Plugin Service注册](https://conf.yasdb.com/pages/viewpage.action?pageId=150625724#411-plugin-service%E6%9C%8D%E5%8A%A1%E6%B3%A8%E5%86%8C)  

  [兼容模式会话参数](https://conf.yasdb.com/pages/viewpage.action?pageId=150625724#421-%E5%85%BC%E5%AE%B9%E6%A8%A1%E5%BC%8F%E4%BC%9A%E8%AF%9D%E5%8F%82%E6%95%B0)  

  [SQL 软解析](https://conf.yasdb.com/pages/viewpage.action?pageId=150625724#422-sql%E8%BD%AF%E8%A7%A3%E6%9E%90)  

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

##   [2. 接口](#2-接口)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**  SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|Plugin Service|在plug-in/service/service.ini中配置服务|----|是/否|
|SQL语法|Alter session set compat_vector=mysql|----|是/否|
|配置参数|COMPAT_VECTOR|会话级、立即生效|是/否|
|驱动接口|驱动对外提供接口描述|----|是/否|


##   [3. 规格与约束](#3-规格与约束)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

###   [4.1 Plugin Service注册](#41-plugin-service注册)  

####   [4.1.1 Plugin Service加载](#411-plugin-service加载)  

![](https://pingcode.yasdb.com/atlas/files/public/67396ea18970c2af4f5219e5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBWUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQkFBQ0FBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg0NTgsImV4cCI6MTc4MjQ0OTI1OH0.Ggv6WKsPN5XM0aS1fovQqx9l8Qf8eM-liTc7LdAmKi8)

- 启动实例时，加载安装目录下plug-in/service/service.ini
- 从service.ini中读取plugin service的配置，包括id、二进制库名称、服务名称、参数
- 到plug-in/service/linux(windows)目录下，查找并加载二进制库
- 调用二进制库中的startService函数


####   [4.1.2 service.ini格式](#412-serviceini格式)  

service.ini文件用于配置需要启动的plugin service服务。

每行配置一个服务（目前只支持mysql服务）

格式为：

SERVICE1 = {library = yas_my, name = mysql, args = "URL=127.0.0.1:1279"}

规格如下：

- 必须以SERVICE开头，后面紧跟一个数字，表示服务的编号（从1开始）。当前最多支持8个服务，因此数字不能超过8
- library为提供服务的二进制库名称，不需要加lib前缀和.so后缀
- name为服务名称，最大支持64字节，暂无意义
- args为每个服务独有的参数，最大支持4096字节。


MySQL服务的参数格式为 “参数名称 = 参数值，..."

MySQL服务允许的参数包括：

|参数名|取值|含义|
|---|---|---|
|URL|ip:port|服务监听地址|
|PACKET_SIZE|整数|协议包大小|


###   [4.2 SQL兼容模式](#42-sql兼容模式)  

####   [4.2.1 会话参数](#421-会话参数)  

参数名：COMPAT_VECTOR

取值范围：YASHAN（或ORACLE）、MYSQL

默认值：由连接协议决定，YashanDB协议连接时，默认值为YASHAN；MySQL协议连接时，默认值为MYSQL

作用范围：会话

修改命令：

```
Alter Session set compat_vector=mysql;

```

####   [4.2.2 数据结构](#422-数据结构)  

```
--会话参数
typedef struct StSesParamCtx {
    SpinLock         lock;
    DateTimeFormat   dateFormatBuffer;
    DateTimeElmtInfo dateTimeElmtInfo;
    CodChar          xisoLevelstr[ANL_SES_PARAM_NORMAL_SIZE];
    CodChar          xCommitWaitstr[ANL_SES_PARAM_NORMAL_SIZE];
    CodChar          nlsNumericCharactersStr[ANS_NLS_NUMERIC_CHARACTERS_BUFFER_SIZE];
    AnlOlCtgy        olCtgy;

    CodText       xisoLevel;
    CodText       dateFormat;
    CodText       xCommitWait;
    CodText       nlsNumericCharacters;
    CodNumber     bloomFilterFactor;
    CostParamAttr costAttr;
    CodUint64     columnarMaxSortMem;
    CodUint64     columnarMaxJoinMem;
    CodUint64     hashAreaSize;
    CodUint64     hashJoinAlgorithm;
    CodUint64     maxVmOpen;
    CodUint32     columnarBulkSize;
    CodUint32     columnarBulkCount;
    CodUint32     bucketValueScaleInHashSet;
    CodUint32     bucketValueScaleInHashTable;
    CodUint32     columnarMaxBatchCount;
    CodUint32     ColumnarMaxHashBucket;
    CodUint32     ColumnarDynamicArrayThreshold;
    CodUint32     degreeOfParallel;
    StatsLevel    statLevel;
    CodUint32     rwrtOpt;
    CodUint32     tabQueueWindowSize;
    CodUint32     chnMaxSegmentSize;
    CodUint16     currUserId;
    CodBool       columnarNonCollidingHash;
    CodUint8      optmzDynLevel;
    CodUint8      tacFilterPushThreshold;
    CodUint8      isQueryRewriteEnabled;
    CodBool       isSlowLogEnabled;
    CodBool       useOptmzInfo;
    CodBool       isEnabledExplainStats;
    CodBool       optmzEnableDupParallel;
    CodBool       columnarFilterInvalid;
    CodBool       columnarQuotaAutoTrace;
    CodBool       isCacheVariable;
    CodBool       isEnableExplainStage;
    CodUint8      compatMode;                --新增
    CodUint8      unused;
    CodUint32     packetSendTimeout;
    CodUint32     maxWorkersPerExec;
} SesParamCtx;

```

```
--词法解析
typedef struct CompatLexer {
    LexCompatRead read;
    LangTokenSet* tokenSet;
    CodChar*      splitChars;
    CodChar*      invalidNameChars;
    CodChar       enClosureChar;
    CodBool       syncCompatStmt;
    CodUint8      reversed[6];
} CompatLexer;

typedef struct StLexer {
    LexerStack     stack;
    LangTokenSet*  tokenSet;
    CodTextPos     globalPos;
    LexReadMode    readMode;
    CodUint16      exUnamableToken;
    CodUint16      charset;
    CodText        orignalText;
    CompatLexer*   compat;        --新增
} Lexer;

```

####   [4.2.3 重载流程](#423-重载流程)  

词法解析

![](https://pingcode.yasdb.com/atlas/files/public/67396ea1a1ad9a3311dc9856/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBWUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQkFBQ0FBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg0NTgsImV4cCI6MTc4MjQ0OTI1OH0.Ggv6WKsPN5XM0aS1fovQqx9l8Qf8eM-liTc7LdAmKi8)

语法解析

![](https://pingcode.yasdb.com/atlas/files/public/67396ea1a1ad9a3311dc9858/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0NBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBWUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQkFBQ0FBQUFBQUVBQUFBQUFBQUFBQUFBQUFCQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg0NTgsImV4cCI6MTc4MjQ0OTI1OH0.Ggv6WKsPN5XM0aS1fovQqx9l8Qf8eM-liTc7LdAmKi8)

###   [4.3 软解析](#43-软解析)  

```
typedef struct StAnlContextAttr {
    CodUint32      initPos;
    CodUint32      bucketId;
    CodDate        firstLoadTime;
    AnlCtxDstbAttr dstbAttr;
    CodUint32      hashValue;           /* sqlText + loginUserId + userId*/
    CodUint32      sqlHashValue;        /* sqlText */
    CodUint16      loginUserId;
    CodUint16      userId;
    CodUint8       poolId;
    CodUint8       partId;
    CodBool        isDesensitize;
    CodUint8       compatMode;   --新增
    CodUint64      userPrivNum;
    List*          roleList;
    List*          userAuthList;
    CodUint64      audSeqNum;
    CodUint32      totalTextLen;
    CodUint32      textLen;
    CodChar*       textAddr;
    AnlSqlId       sqlId;             /* md5 + base32 to calc sqlText*/
    CodUint64      axlVersion;
    ParseSessParamAttr parseSessParam;
} AnlContextAttr;

```

软解析时，在anlContextMatches里增加比较compatMode的逻辑。

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [6.资料设计章节](#6资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[lexRead.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTE4OTcwYzJhZjRmNTIxOWU0IiwicmVmX2lkIjoiNjczOTZlYTA3MjgyMDZlZmI5MmYyYTE0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NDU3LCJleHAiOjE3ODI1MjQ4NTd9.J_HHjBGO2F-EYgx3rTTeo3u62Yp26IYwsu-a43i1_OE)

 (image/png)    
