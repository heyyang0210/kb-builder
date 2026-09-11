Created by 陈敬厅, last modified on 二月 09, 2023

SR链接：    [YDBRD-8023](https://jira.yasdb.com/browse/YDBRD-8023?src=confmacro)    -  实现视图V$SQL_BIND_CAPTURE  完成

对应调研文档页面：    [YDBRD-8023：视图V$SQL_BIND_CAPTURE 调研文档 - 陈敬厅 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=100093468)  



-   [1. Overview 概论](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-1.Overview概论)  
    -   [1.1 字段设置](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-1.1字段设置)  
    -   [2.1 feature1](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-2.1feature1)  
    -   [2.2 feature2](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-2.2feature2)  
    -   [2.3 feature3](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-2.3feature3)  
-   [3. Interfaces（接口）](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-3.Interfaces（接口）)  
    -   [3.1 interface1](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-3.1interface1)  
    -   [3.2 interface2](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-3.2interface2)  
-   [4. Specification And Constraints（规格和约束）](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-4.SpecificationAndConstraints（规格和约束）)  
    -   [4.1 规格1](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-4.1规格1)  
    -   [4.2 规格2](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-4.2规格2)  
    -   [4.3 规格3](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-4.3规格3)  
    -   [4.4 规格4](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-4.4规格4)  
-   [5. 详细设计](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-5.详细设计)  
    -   [5.1 绑定变量的值需要15分钟更新一次](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-5.1绑定变量的值需要15分钟更新一次)  
    -   [5.2 绑定变量的结构体设置](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-5.2绑定变量的结构体设置)  
    -   [5.3 绑定变量的值的获取](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-5.3绑定变量的值的获取)  
    -   [5.4 在parse阶段](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-5.4在parse阶段)  
-   [6. 自测用例](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-6.自测用例)  
    -   [6.1 全量查询、投影](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-6.1全量查询、投影)  
    -   [6.2 条件查询](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-6.2条件查询)  
    -   [6.3 连表查询](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-6.3连表查询)  
    -   [6.4 增删改视图](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-6.4增删改视图)  
-   [7. TODO（遗留问题）](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-7.TODO（遗留问题）)  
-   [8. 工作量估计](#YDBRD8023：视图V$SQL_BIND_CAPTURE设计文档-8.工作量估计)  




# **1. Overview 概论**

本需求设计为YashanDB提供绑定变量视图的功能，对外提供最近在SQL中使用的绑定变量及其相关字段的的查询。

## **1.1 字段设置**

|字段|类型|说明|
|---|---|---|
|ADDRESS|RAW(8)|父游标的地址，保留字段|
|HASH_VALUE|BIGINT|sql的hashValue， 由sqlText计算得到|
|SQL_ID|VARCHAR(13)|sqlText 的 md5 + base32 结果|
|CHILD_ADDRESS|RAW(8)|子游标的地址，保留字段|
|CHILD_NUMBER|INTEGER|子游标数量：  当前设计只有一个child cursor|
|NAME|VARCHAR(128)|绑定变量的名称|
|POSITION|INTEGER|绑定变量在sql中的位置，下标|
|DUP_POSITION|INTEGER|假如该绑定变量在sql中有重复使用，则此列的值设置为首个扫描到的绑定变量的位置|
|DATATYPE|INTEGER|绑定变量数据类型的内部标识符|
|DATATYPE_STRING|VARCHAR(15)|绑定变量数据类型的文本表示|
|CHARACTER_SID|INTEGER|国家/地区字符集标识符|
|PRECISION|INTEGER|精度（数值类型的绑定变量）|
|SCALE|INTEGER|范围（数值类型的绑定变量）|
|MAX_LENGTH|INTEGER|绑定变量的最大长度|
|WAS_CAPTURED|VARCHAR(3)|标识绑定值是否被捕获（YES/NO)|
|LAST_CAPTURED|DATE|捕获绑定变量值的日期，执行sql语句时捕获绑定变量的值，或者对于已缓存的sql语句，每15分钟去捕获其绑定变量的值。|
|VALUE_STRING|VARCHAR(4000)|表示为字符串类型的绑定变量的值|


**2. Features（特性）**

## **2.1 feature1**

绑定变量视图提供当前所有在SGA库缓存中，已经缓存的所有sql的绑定变量及其相关字段的查询。

## **2.2 feature2**

绑定变量视图每15分钟捕获一次绑定变量的值，不会实时更新绑定变量的值。

## **2.3 feature3**

绑定变量视图可以与其他含有公共字段的视图或者表进行表连接查询，不支持增删改等操作。

  


# **3. Interfaces（接口）**

## **3.1 interface1**

*CodResult *  *dvSqlBindCaptureOpen*  *(AnkCoursor* cursor)*  *;*

Open函数初始化视图功能，初始化列和表头，等待后续fetch函数获取和组装每一行的值。

## **3.2 interface2**

*CodResult *  *dvSqlBindCaptureFetch*  *(AnkCoursor* cursor, RowManager* rm)*  *;*

Fetch函数实现绑定变量视图里每一行数据的组装，即从库缓存中获取绑定变量的值和相关字段的值。

# **4. Specification And Constraints（规格和约束）**

## **4.1 规格1**

绑定变量视图不支持增删改等操作。

## **4.2 规格2**

绑定变量视图在数据库服务端进程被杀或者共享内存池被清空的时候，会失去已缓存的绑定变量的值。

## **4.3 规格3**

绑定变量视图所展示的绑定变量的类型只能是简单的数据类型，排除LONG，LOB，ADT类型的绑定变量，即这些类型的绑定变量不会在视图中查询到。

## **4.4 规格4**

绑定变量视图当  STATISTICS_LEVEL参数被设置为BASIC时将无法收集信息，也就无法从视图中查询数据，至少要将该参数设置为typical以上。

  


# **5. 详细设计**

## **5.1 绑定变量的值需要15分钟更新一次**

在执行sql时，会进行判断，假如超过了15分钟就更新

1. CodResult   anlCheckParamOutOfDate  (AnlStmt* stmt)
1. {
1.     AnlContext*    newCtx = stmt->context;
1.     AnlPool*       pool = &stmt->handler->inst->sqlPool[newCtx->attr.poolId];
1.     AnlPart*       part = &pool->parts[newCtx->attr.partId];
1.     AnlBucket*     bucket = &pool->buckets[newCtx->attr.bucketId];
1.     
1.       if   (stmt->context->parseTree->params ==   NULL  ) {
1.           return   COD_SUCCESS;
1.     }
1.     
1.     CodDate nowTime = anlNow(stmt->handler);
1.     spinLock(&bucket->lock, SPINLOCK_SQL_POOL);
1.     AnlContext* curr = bucket->head;
1.       if   (nowTime - stmt->plancontext->params.lastCaptured >  _cursor_bind_capture_interval) {
1.           //update param value
1.         spinUnlock(&bucket->lock);
1.     }
1.     spinUnlock(&bucket->lock);
1.       return   COD_SUCCESS;
1. }


## **5.2 绑定变量的结构体设置**

1. typedef     struct     StAnlParamItem   {
1.     Variant   value;
1.       union   {
1.           struct   {
1.             CodUint8  proType;
1.             CodUint8  proDir;    // for parameter binding
1.             CodUint8  precision;
1.             CodInt8   scale;
1.             CodUint16 version;
1.             CodUint16 size;
1.         };
1.         SoUdtDef* udtDef;
1.         TypeRef*  typeRef;
1.     };
1.     
1.     CodUint16  properties;
1.     CodUint16  argPos;
1.     CodUint8   flags;
1.     CodUint8   unused[  3  ];
1. } AnlParamItem;


## **5.3 绑定变量的值的获取**

通过访问sql pool缓存，获取绑定变量的值，然后在Fetch函数中，使用rm组装行

1.     ...
1.     rowAddNull(rm);                                      /* ADDRESS */
1.     rowAddInt64(rm, ctxAttr->sqlHashValue);              /* HASH_VALUE */
1.     rowAddNullableText(rm, &sqlId);                              /* SQL_ID */
1.     rowAddNull(rm);                                      /* PLAN_HASH_VALUE */
1.     rowAddNull(rm);                                      /* CHILD_ADDRESS */
1.     rowAddInt32(rm,   1  );                               /* CHILD_NUMBER */
1.     ...


## 5.4 在parse阶段

# **6. 自测用例**

## **6.1 全量查询、投影**

*select*  * * *  *from*  * v$sql_bind_capture;*

*select*  * *  *name*  *, sql_id *  *from*  * v$sql_bind_capture;*

*select*  * address, child_address *  *from*  * *  *from*  * v$sql_bind_capture;*

*...*

## **6.2 条件查询**

*select*  * *  *name*  *, sql_id *  *from*  * v$sql_bind_capture *  *where*  * *  *name*  * = *  *"**"*  *;*

*select*  * sql_id, *  *position*  * *  *from*  * v$sql_bind_capture *  *where*  * datatype *  *like*  * *  *"varchar%"*  *;*

*select*  * *  *name*  *, hash_value, child_number *  *from*  * v$sql_bind_capture *  *where*  * max_length < *  *50*  *;*

*...*

## 6.3 连表查询

*select*  * *    [t1.name](http://t1.name)    *, t1.sql_id, t2.time_stamp *  *from*  * v$sql_bind_capture t1 *  *join*  * v$sql_plan t2 *  *on*  * (t1.hash_value = t2.hash_value);*

*...*

## 6.4 增删改视图

*drop*  * *  *view*  * v$sql_bind_capture;*

*alter*  * *  *view*  * v$sql_bind_capture *  *add*  * col1 *  *integer*  *;*

*update*  * v$sql_bind_capture *  *set*  * *  *name*  * = *  *"***"*  *, sql_id = *  *"***"*  * *  *where*  * hash_value = *  *"*****"*  *;*

*delete*  * *  *from*  * v$sql_bind_capture *  *where*  * sql_id = *  *"*****"*  *;*

*insert*  * *  *into*  *  v$sql_bind_capture *  *values*  * (****, *****, *****, ...);*

*...*

# **7. TODO（遗留问题）**

1.需要在x$parameter上添加一个隐含参数，  _cursor_bind_capture_interval。

2.parameterItem需要添加成员变量用以承载字段。

# **8. 工作量估计**

一周