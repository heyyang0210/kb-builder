Created by 马志宏, last modified on 八月 05, 2024

*cIR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7440009f91eb87f2b0bc](https://pingcode.yasdb.com/ship/ideas/660b7440009f91eb87f2b0bc)      


*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6614eb1cfd997db58ad62d14](https://pingcode.yasdb.com/pjm/items/6614eb1cfd997db58ad62d14)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

数据库CDC（Change Data Capture，数据变更捕获）是一种用于跟踪数据库中数据变化的技术。通过解析Redo日志，可以捕获数据库中的数据变更操作，包括插入、更新、删除等操作，通常用于：

1. 异构数据库复制：将源数据库中的数据变更实时同步到异构目标数据库中。
1. 数据集成：  将不同数据库之间的数据变更进行集成和同步。


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

1. YashanDB缺少一个通用的CDC API接口，供第三方抓取YashanDB的逻辑日志。
1. 崖山目前异构数据库同步工具YDS有如下缺点：    

1.     - 现有C接口仅支持原始日志解析为二进制数据，  **没有事务组装，类型转换的能力**  ，第三方适配难度大，  **易用性差**
    - YDS通过  **JNA调用C接口**  ，性能损耗大
    - 基于Flink开源架构，bug定位难度大，修复不及时

1. **滚动升级**  需要逻辑复制作为基础特性


第三方厂商希望YashanDB提供java形式的API，可直接解析出按事务顺序组装好的SQL。YDS重构也需要一个高性能且易用的API接口。

部署形态：  **单机**  ，支持  **行存和列存**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [CDC日志解析API特性调研](/pages/createpage.action?spaceKey=YAS&title=CDC%E6%97%A5%E5%BF%97%E8%A7%A3%E6%9E%90API%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|日志挖掘|多线程并行解析Redo|是|是|
|  
|元数据管理|解析过程中维护表的元数据|是|是|
|  
|数据持久化|溢出事务，checkpoint和元数据的持久化|是|是|
|可用性|恢复场景|重启，主备切换后断点续传|是|是|
|安全|安全场景|加密表空间持久化|否|是|
|周边配合|权限|新增角色，供日志解析用|否|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|CDC|Change Data Capture，数据变更捕获。CDC是一套基于识别、捕获和传播对源数据库增量变更的方案。|是|  [https://en.wikipedia.org/wiki/Change_data_capture](https://en.wikipedia.org/wiki/Change_data_capture)  |
|LCR|Logical Change Record  ，逻辑变更日志。通常是内部定义的一种中间格式，用来描述CDC捕获的数据库的增量变更|是|  [https://docs.oracle.com/en/database/oracle/oracle-database/23/xstrm/general-xstream-concepts.html#GUID-71F649DC-F09A-4B5B-BB1C-4325871E3AEE](https://docs.oracle.com/en/database/oracle/oracle-database/23/xstrm/general-xstream-concepts.html#GUID-71F649DC-F09A-4B5B-BB1C-4325871E3AEE)  |
|Logminer|Oracle的一个组件，可以使用视图查询在线和存档的重做日志文件内容，查询结果是SQL语句|  
|  [https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/oracle-logminer-utility.html#GUID-3417B738-374C-4EE3-B15C-3A66E01AE2B5](https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/oracle-logminer-utility.html#GUID-3417B738-374C-4EE3-B15C-3A66E01AE2B5)  |


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|  
|**接口**|**简介**|**详细**|
|:---:|:---:|:---:|:---:|
|高级包    
    
    
|DBMS_YSTREAM_ADM.  CREATE(server_name, connect_user, start_scn  )|创建一个YStream server，设置起始点，仅写入系统表，不启动YStream server线程。|server_name：  指定server名字,connect_user：允许连接的user名字，为NULL则不限，但必须有YSTREAM权限才能连接,start_scn：开始解析点，  如果为NULL，则从当前scn开始（start scn之前启动的事务都不会被解析）|
||DBMS_YSTREAM_ADM.ADD_TABLES(  server_name,   table_names, schemas)|添加要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。可在YStream server运行时执行，如果不指定，则解析所有表。|server_name：  指定server名字,table_names：指定一组表名。格式为scheme1.table_name1, scheme2.table_name2,scheme3.table_name3,schemas：指定一组scheme。格式为scheme1,scheme2|
||DBMS_YSTREAM_ADM.DROP_TABLES(  server_name,   table_names, schemas)|删除要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。|server_name：  指定server名字,table_names：指定一组表名。格式为scheme1.table_name1, scheme2.table_name2,scheme3.table_name3,schemas：指定一组scheme。格式为scheme1,scheme2|
||DBMS_YSTREAM_ADM.  SET_PARAMETER(server_name, parameter, value)|设置Logminer相关的参数|server_name：  指定server名字,parameter：参数名字符串,value：参数值字符串,  
,参数名：,- PARALLELISM: 并发度，[1, 128  ]， 默认 1
- TXN_AGE_SPILL_THRESHOLD ：事务溢出时间,[1, 100000], 单位 s， 默认 600
- TXN_LCR_SPILL_THRESHOLD：事务溢出大小 [1K, 1T], 默认 1G
- CHECKPOINT_INTERVAL：checkpoint 周期， [1, 3600]，单位 s， 默认 3
|
||DBMS_YSTREAM_ADM.START(  server_name  )|启动日志解析，如果是第一次启动，则从start scn开始；否则是从checkpoint点开始|server_name：  指定server名字|
||DBMS_YSTREAM_ADM.STOP(  server_name, force  )|停止日志解析|server_name：  指定server名字,force: 备库上STOP，如果备库和主库断连，无法通知主库修改系统表，则可以用force标志强制停止（系统表中状态不会变）|
||DBMS_YSTREAM_ADM.DROP(  server_name)|删除YStream server，释放对应的内存，持久化数据|server_name：  指定server名字|
|系统视图|ALL_YSTREAM  _PARAMETERS|YStream相关参数|SERVER_ID              INTEGER     
  PARAM_NAME        VARCHAR(64)     
  PARAM_VALUE       VARCHAR(64)   参数当前值    
  PARAM_DEFAULT   VARCHAR(64)    参数默认值|
||ALL_YSTREAM  _TABLES|显示所有需要解析的表名，scheme|SERVER_ID              INTEGER,SERVER_NAME       VARCHAR(64)    
  SCHEMA                   VARCHAR(64)     
  TABLE_NAME          VARCHAR(64)|
|动态视图|V$YSTREAM_SERVER|显示所有YStream server的状态，包括运行状态，启动时间，当前进度，checkpoint|SERVER_ID                 INTEGER,SERVER_NAME          VARCHAR(64),STATUS                      VARCHAR(16),CREATE_TIME            TIMESTAMP,START_SCN               BIGINT    
  START_POINT            VARCHAR(32)    
  RESTART_POINT        VARCHAR(32),RESTART_POSITION  VARCHAR(64)    
  CAPTURE_POINT      VARCHAR(32),CAPTURE_POSITION VARCHAR(64),APPLIED_POSITION  VARCHAR(64)    
  ERROR                       VARCHAR(1024)|
||V$YSTREAM_STAT|显示所有Logminer Sever的统计信息，包括send大小，解析大小，溢出事务大小等|SERVER_ID                 INTEGER,SERVER_NAME          VARCHAR(64),CodDate     startTime  ;    
  CodUint64   sendSize  ;    
  CodUint64   sendLcrCnt  ;    
  CodUint64   captureRedoSize  ;    
  CodUint64   captureLcrCnt  ;    
  CodUint64   spillSize  ;    
  CodUint64   spillLcrCnt  ;    
    
  CodUint64   redoReadCnt  ;    
  CodUint64   redoSortCnt  ;    
  CodUint64   recordDecodeCnt  ;    
  CodUint64   recordFetchCnt  ;    
    
  CodDate   redoReadTime  ;    
  CodDate   redoSortTime  ;    
  CodDate   recordDecodeTime  ;    
  CodDate   recordFetchTime  ;    
    
    
,  
,XACT_MEMORY_USED         BIGINT,spillXactCtx  _MEMORY_USED         BIGINT,ddlCtx_MEMORY_USED         BIGINT|
||V$YSTREAM_EVENTS|显示YStream server的事件，包括启动，关闭，重连，修改过滤条件等|暂时不做|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**规格：**

1. 最多可以启动32个YStream server
1. YStream server名字最大长度32
1. 最大支持配置10000张表，100个schema，也可以配置为所有表
1. 仅支持单机主备


**约束：**

1. where条件列不包含LOB列或者LOB格式存储的类型（如8K以上的varchar）
1. DBMS_LOGIC_STREAM的函数（除START，STOP）只能在主库上执行
1. 一个LogMiner只能同时和一个客户端连接
1. 一个主备组里，不能在多个实例上启动同一个Logminer
1. 不支持UDT类型的表
1. 不支持XML，JSON等复杂类型的列
1. 只支持部分DLL（资料中体现白名单）
1. 所有事务要在提交后发送，不支持大事务提前发送
1. YStream Server需要的归档不会自动清理，可以用Force手动清理


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**     针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

  


### 4.1 框架

![](https://conf.yasdb.com/download/attachments/144143577/image2024-3-4_22-20-7.png?version=1&modificationDate=1709562008000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

### 4.2 内存管理

#### 4.2.1 Stream pool

日志解析，事务组装，元数据缓存都需要申请内存，其中事务组装占大头，内存占用空间可达在几百M。这些内存需要考虑淘汰和复用，尽可能减少对数据库的影响，需要有一套内存管理机制，

新增参数  **STREAM_POOL_SIZE**  （默认值为0），表示逻辑日志解析需要的内存池。该参数可以  **立即生效**  ，在内存里malloc一片内存，供所有的Logminer Server使用。

![](https://pingcode.yasdb.com/atlas/files/public/67396d598970c2af4f52123a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

- Stream Pool有多块Mctx组成，每个Mctx是一片连续的内存
- 支持动态扩展，当STREAM_POOL_SIZE设置成更大的值时，增量malloc一块Mctx，追加到stream pool里，不影响正在进行的日志解析
- Stream Pool的每个页面大小为32K
- Stream Pool有两条链，usedList和freeList，空闲的页面挂在freeList上
- 日志解析，事务组装，元数据缓存都以页面为单位，从freeList申请内存，不用时，将页面归还到freeList上。


#### 4.2.1 接口

##### 接口1. free one block

- 根据释放的内存地址偏移查找到该地址所属页面
- 将页面从memory context的页面链上摘下
- 将该页面归还到memory pool，挂在memory pool的freeBlocks上


```
```C
// 从context上摘下
static CodVoid mctxRemoveOneBlock(MemoryContext* context, MpoolBlockCtrl* ctrl) 
{
    MpoolBlockCtrlList* blockList = &context->blocks;
    MpoolBlockCtrl*     prvCtrl = blockList->head == ctrl ? NULL : mctxBlockGetById(&context->blocks, mctxGetBufBlockId(context, (CodChar*)ctrl) - 1);

    if (prvCtrl == NULL) {
        blockList->head = ctrl->next;
    }

    if (blockList->tail == ctrl) {
        blockList->tail = prvCtrl;
        context->currCtrl = blockList->tail;
        context->currPos = context->pool->blockSize;
    }

    if (prvCtrl != NULL) {
        prvCtrl->next = ctrl->next;
    }
    
    ctrl->next = NULL;
    blockList->count--;
}

CodVoid mctxFreeOneBlock(MemoryContext* context, CodChar* buf)
{
    MemoryPool*     pool = context->pool;
    MpoolBlockCtrl* ctrl = mctxBlockGetById(&context->blocks, mctxGetBufBlockId(context, buf));

    mctxRemoveOneBlock(context, ctrl);
    mpoolSpinLock(pool);
    mpoolListAddTail(&pool->freeBlocks, ctrl);
    mpoolSpinUnlock(pool);
}

```
```

  


##### 接口2. truncate blocks(主要用于rollback to savepoint)

- 根据释放的内存地址偏移查找到该地址所属页面
- 以此页面作为起始页面，该context上页面链的尾页作为结束页面，从链上摘下
- 将这一批页面归还到memory pool，挂在memory pool的freeBlocks上
- 更新context的各个属性block count、currCtrl、tail


```
```C

static CodUint32 mctxGetBufBlockId(MemoryContext* context, CodChar* buf)
{
    MpoolBlockCtrl* ctrl = context->blocks.head;
    CodUint32       id = 0;

    for (CodUint32 i = 0; i < context->blocks.count; i++) {
        if (buf >= (CodChar*)ctrl && buf < (CodChar*)ctrl + sizeof(MpoolBlockCtrl) + context->pool->blockSize) {
            id = i;
            break;
        }
        ctrl = ctrl->next;
    }

    return id;
}

static MpoolBlockCtrl* mctxBlockGetById(MpoolBlockCtrlList* blockList, CodUint32 id)
{
    MpoolBlockCtrl* ctrl = blockList->head;

    for (CodUint32 i = 0; i < blockList->count; i++) {
        if (i == id) {
            break;
        }
        ctrl = ctrl->next;
    }

    return ctrl;
}

CodVoid mctxTruncate(MemoryContext* context, CodChar* buf)
{
    CodUint32 blockId = mctxGetBufBlockId(context, buf);
    if (blockId == 0) {
        mctxDestroy(context);
        return;
    }

    CodUint32          truncBlockCnt = context->blocks.count - blockId;
    MpoolBlockCtrlList truncBlockList = {
        .count = truncBlockCnt,
        .head = mctxBlockGetById(&context->blocks, blockId),
        .tail = context->blocks.tail,
    };

    mpoolSpinLock(context->pool);
    mpoolConcatBlockList(&context->pool->freeBlocks, &truncBlockList);
    mpoolSpinUnlock(context->pool);
    context->blocks.count -= truncBlockCnt;
    context->blocks.tail = mctxBlockGetById(&context->blocks, context->blocks.count - 1);
    context->currCtrl = context->blocks.tail;
    context->currPos = context->pool->blockSize;
}

```
```

  


##### 接口3. memheap shrink(主要用于元数据频繁更新后的空间回收)

- 根据mem heap页面头的高水位线是否为1判断该页面是否未使用
- 如果是则将该页面从mem heap上摘下
- 调用mem heap的freeMem接口（free one block）将该页面归还给mem pool


  


```
```C

CodVoid mheapShrink(MemHeap* heap)
{
    if (heap->freeMem == NULL) {
        COD_ASSERT(0);
        return;
    }

    for (CodUint32 i = heap->blocks->count; i > 0; i--) {
        MemHeapCtrlHead* head = (MemHeapCtrlHead*)objArrayGet(heap->blocks, i - 1);

        if (head->hwm != 1) {
            continue;
        }

        objArrayDelete(heap->blocks, i - 1);
        heap->freeMem(heap->owner, head);
    }
}

```
```

  


### 4.3 元数据管理

#### 4.3.1 管理概述

- 初始化：根据用户指定要解析的表以及  **起始scn**  ，通过  **闪回查询系统表**  ，得到起始scn对应的表的元数据。
- 增量更新：在表相关的DDL的  **逻辑日志里，附加元数据的增量变更信息**  。解析过程中，遇到DDL的日志，则从逻辑日志里得到变更的元数据，更新当前元数据缓存。
- 元数据缓存：drop table或drop column释放元数据空间，并且空洞达到一定阈值后  进行shrink，将空闲页面归还到Stream Poo  l
- 持久化：如果每次重启都通过闪回查询重建元数据，可能会有  **快照太旧**  的风险，所以元数据也需要持久化，具体时机为执行checkpoint时，如果元数据相比上一次checkpoint有变更，则进行持久化


#### 4.3.2 元数据结构

###### 1.TABLE元数据结构

|属性|类型|描述|
|:---|---|:---|
|OBJ#|BIGINT|对象序号（全局唯一）|
|TYPE|INTEGER|表类型|
|COLS|INTEGER|列数|
|VCOLS|INTEGER|虚拟列数|
|FLAGS|INTEGER|是否为NO LOGGING、收集统计信息等|
|PROPERTY|INTEGER|开启、禁止ROWMOVEMENT等|
|OWNER|INTEGER|所有者|
|TABLE_NAME|VARCHAR(64)|表名|
|VERSION|BIGINT|版本|
|HAS_LOB|BOOL|是否有lob列|


###### 2. COLUMN元  数据结构

|属性|类型|描述|
|:---|---|:---|
|COLUMN_ID|INTEGER|列ID（列在表中的序号）|
|COLUMN_NAME|VARCHAR(64)|列名|
|DATA_TYPE|INTEGER|类型|
|SIZE|INTEGER|长度|
|NULL$|INTEGER|能否为空值|
|FLAG|INTEGER|判断是否将varchar按lob存储|
|DATA_PRECISION|INTEGER|精度|
|DATA_SCALE|INTEGER|范围|
|CHAR_LENGTH|INTEGER|字符类型长度|
|DEAFULT|VARCHAR(8000)|默认值|


#### 4.3.3 元数据初始化

- 表元数据和列元数据结构固定128字节  ，表使用哈希桶存储
- 每个表元数据结构有指向第一列的元数据结构的指针，列元数据使用双向链表存储
- 根据  logminer server指定的表名或者schema从OBJ$中获取objectId
- 根据objectId从TAB$中加载表的各个元信息
- 根据objectId从COL$中加载各个列的各个元信息


  


![](https://pingcode.yasdb.com/atlas/files/public/67396d59a1ad9a3311dc90ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

#### 4.3.4 元数据更新

- DDL操作引起表或者列的元数据发生变更，根据DDL类型以表元数据结构和列元数据结构为单位对缓存元数据进行更新
- CREATE TABLE示例：申请新的页面向TAB链上插入
- DROP COLUMN示例：将删除的COL从COL链上摘除，并修改TAB元数据的列个数
- RENAME COLUMN示例：将COL元数据中的列名属性更新


  


![](https://pingcode.yasdb.com/atlas/files/public/67396d59a1ad9a3311dc90ad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

#### 4.3.5 DDL附加元数据日志

- 增加2个日志类型：LOGT_MINER_METADAT_TAB（定长），LOGT_MINER_METADAT_COL（变长）
- 日志内容：（type，xmap，oid）+ 元数据
- 每条日志一个原子操作
- CREATE TABLE：LOGT_MINER_METADAT_TAB + n个LOGT_MINER_METADAT_COL
- DROP TABLE：LOGT_MINER_METADAT_TAB
- ALTER TABLE：
    - 增加列：m个LOGT_MINER_METADAT_COL
    - 删除列：m个LOGT_MINER_METADAT_COL（只需要填列ID）
    - 改列类型：LOGT_MINER_METADAT_COL
    - 改列名：LOGT_MINER_METADAT_COL
    - 改表名：LOGT_MINER_METADAT_TAB


### 4.4 事务组装

- 为了提高API易用性，Logminer Server向API输出的数据是按照事务顺序排序，并且只发送提交的事务。
- 事务组装模块，有两个链表，分别存放活跃事务LCR和提交的事务LCR，  活跃事务队列结构是个以xid为索引的hash桶，以便在追加DML时，更快找到对应的事务
- 每追加一个DML，该事务上的sequence加一，该值单调递增


  


![](https://pingcode.yasdb.com/atlas/files/public/67396d598970c2af4f52123b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

#### 4.4.1 事务解析

- 解析到xact begin，则向活跃事务队列添加一个节点
- 解析到DML，DDL，找到对应的事务，将数据追加到该事务缓存中
- 解析到rollback savepoint，则从活跃事务队列里，删除savepoint点之后的数据
- 解析到rollback，则从活跃事务队列里摘除
- 解析到xact  commit，则将活跃事务缓存，移到提交事务队列上


#### 4.4.1 提交事务淘汰

当客户端返回applied scn后，将小于该scn的提交事务从队列里删除，同时将对应的溢出LCR从系统表里删除

#### 4.4.1 事务溢出处理（两种事务需要考虑溢出）

- 长时间不提交的事务，这种会阻塞checkpoint，需要持久化来推进checkpoint，减少重启恢复时间，保证归档日志可清理
- 大数据量事务，这种事务会占用大量内存，需要持久化释放内存
- 这两种事务的溢出条件分别由Logminer参数txn_age_spill_threshold、txn_lcr_spill_threshold控制


#### 4.4.1 大事务溢出

解析到DML的LCR后，在追加到事务缓存后，判断该事务内已缓存的LCR总大小，如果超过txn_lcr_spill_threshold的值，则将缓存中的LCR一行行插入系统表，插入成功后，并从buffer删除已经持久化的LCR

并在该事务状态里标记溢出的LCR数量

#### 4.4.1 长事务溢出

解析到DML的LCR后，在追加到事务缓存后，判断该事务启动时间，如果超过txn_age_spill_threshold的值，则将缓存中的LCR一行行插入系统表，插入成功后，并从buffer删除已经持久化的LCR

并在该事务状态里标记溢出的LCR数量

#### 4.4.1 溢出事务rollback

- 对于rollback savepoint，如果该事务有溢出的LCR，则需要扫描系统表，将savepoint之后的溢出LCR delete
- 对于rollback，直接删除该事务所有的溢出LCR


#### 4.4.1 系统表加速

对于溢出事务，Oracle使用TXN_ID来做分区，每个事务一个分区（需  要先支持List分区，  YashanDB暂未实现，用TXN_ID作为索引，加速查找）

### 4.5 Checkpoint

checkpoint的目的是，根据客户端返回的  **应用位置**  ，推进logminer的  **重启解析点**  ，以便服务端安全清理重启解析点之前的归档。

#### 4.5.1 各个point的概念

注：这里的point并不是仅仅指RdPoint，而是比RdPoint更精确，  **精确到一个record的具体位置**  。因此除了RedoPack的RdPoint，还包含SCN，LSN，group offset等

|  
|  
|  
|
|---|---|---|
|**applied point**|由客户端提供，客户端已经提交的位置。该位置之前的所有逻辑日志不再使用，可以清理对应的归档。|初始化为解析开始点.|
|**oldest txn point**|最老未提交事务开始点，所谓的  **"提交"**  是针对客户端的应用位置，  **即applied point**  ，而不是logminer解析的活跃事务（因为logminer解析完的已提交事务，客户端可能还没提交）。|  
|
|**restart point**|服务端  **重启日志解析开始点**  ，从这点解析可以保证客户端  **未提交事务都被恢复**  ，而不丢失。一般来说，restart point == oldest txn point，但是在以下场景，restart point > oldest txn point:,    oldest txn point对应的事务是  **长时间不提交的事务，或者是数据量很大的事务**  ，它的部分或全部LCR被YStream server溢出到磁盘，被持久化的这部分LCR，可以不用从Redo里解析，那么这个restart point可以往后推进，推进到未持久化的部分LCR对应的point。|  
|
|**send point**|服务端发送，并且被客户端收到的最新LCR的point。|  
|
|**catpure point**|服务端已经解析的最新LCR的point，这个point是所有point里最大的。|  
|


  


各个点大小比较：

oldest txn point <= restart point <= applied point <= send point <= catpure point

#### 4.5.2 单个事务的restart point

单个事务的restart point，就是这个事务要恢复的Redo解析开始点，从该点之前解析Redo，不会漏掉该事务的任何数据。有两种情况：

1. 该事务没有溢出到磁盘，没有任何DML的持久化，则这个restart point就是这个事务start point，即  **LOGT_XACT_BEGIN对应的point**
1. 该事务有部分DML溢出到磁盘了，则这个restart point可以优化为  **最后一条持久化的DML point**


重启恢复的restart point，可以理解为所有  **没有被客户端应用的事务**  中，restart point最小的那个

##### 方案一

构造一个"脏页”队列，将所有在applied point之后提交的事务挂在该队列上，并按照  **事务的restart point升序排序**

当applied point更新后，从队列里摘除commit scn小于applied point的事务，然后取队头的restart point作为持久化的restart point

**优点**  ：restart point精确，恢复时不会多解析日志。

**缺点**  ：当客户端长时间不更新applied point，会有大量的事务挂在队列上，内存可能会爆

##### 方案二

每隔几秒，以当前的  **send point**  作为断点续传位置，计算一个相应的restart point，并把（restart point，send point）组成一对放在内存里。一段时间后，内存里会有多个restart point对。

根据客户端返回的applied point，在以上restart point对中，找到一个  **send point小于并且最接近applied point**  的那个，作为持久化的restart point。其余的更小的restart point对可以清理掉

如果客户端长时间不更新applied point，会导致生成很多restart point对，此时可以  **淘汰掉一些point对**  ，比如：把偶数位置的restart point对淘汰，节省一半空间。

  


**优点**  ：实现简单，不需要维护"脏页"队列，即使客户端长期不更新applied point，也不会因为事务太多导致内存爆掉

**缺点**  ：restart point偏小，恢复时会多解析一些日志。

  


结论：选方案二

#### 4.5.3 已发送事务内存清理

Logminer组装好事务后，就放到已提交队列，等待发送到客户端，如果客户端返回接收ACK，则将send point更新为客户端最近收到的一次事务point

send point之前的事务已经发给客户端，可以从已提交队列中摘除，释放内存（该事务有持久化内容不能清理）

#### 4.5.4 RestartPoint队列

RestartPoint队列就是（restart point，send point）对组成的循环队列，该队列是固定长度的数组，长度为100。如果每3秒执行一次restart point记录，可以保存最近300s内的restart point。

##### RestartPoint队列维护细节

1. 每隔一定间隔，记录当前send point
1. 扫描已解析的未提交事务，找出未提交事务中最小的restart point
1. 扫描已提交队列中的事务，找出已提交事务中最小的restart point
1. 选两者中更小的restart point
1. 将（restart point，send point）组成一对，添加到循环队列上
1. 如果队列长度超过上限（假设1000），则将位于偶数位置的摘除，重排队列并挤掉空洞，释放一半空间。


![](https://pingcode.yasdb.com/atlas/files/public/67396d59a1ad9a3311dc90ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

以上是RestartPoint队列的空间释放示意图，上图里队列最大长度是6，每次队列长度到达6之后，插入下一个restart point之前，先把偶数位置的restart point对摘除

从效果上看，较早时间点的restart point比较稀疏，误差较大，最近时间点的restart point比较稠密，误差较小。

所以只要客户端即时更新applied point，重启恢复时不会扫描太多Redo，客户端长时间不更新applied point时，重启恢复时才会多回放较多Redo。

#### 4.5.5 Checkpoint的更新推点

1. 执行checkpoint时，从RestartPoint队列上  **倒序扫描**  ，找到一个  **小于等于applied point的send point**
1. 将该send point对应的  **restart point和applied point写入系统表（YSTREAM_SERVER$）**
1. 如果找不到，则restart point == applied point


#### 4.5.6 持久化  事务的处  理

未持久化的事务，肯定在restart point之后会遇到XACT_BEGIN，可以完整的恢复出来，无需处理

由于applied point之前提交的持久化的事务会被清理，所以在重启恢复时，持久化事务，有两种情况：

1. 这个事务的XACT_BEGIN在restart point之前，即在restart point时刻，这是个活跃事务
1. 这个事务的XACT_BEGIN在restart point之后，即在restart point时刻，这个事务还没启动


对于情况1，我们需要在  **活跃事务队列**  上把此类事务的信息从系统表里读出来，当作已存在的活跃事务处理。后面解析到该事务的DML时，判断一下是不是持久化了，若持久化则跳过。

对于情况2，后续解析Redo过程中会遇到，简单的做法就是这类事务的  **持久化信息直接delete掉**  ，后面遇到XACT_BEGIN就当新事务处理

（暂时不考虑保存情况2的事务，否则解析过程中可能会遇到xslot相同事务，不好处理）

#### 4.5.7 重启恢复流程

1. 从系统表读取restart point和applied point
1. 扫描系统表里的持久化事务
    1. 如果是在restart point之前启动的持久化事务，将该事务的信息读出来，构造一个活跃事务，挂在活跃事务队列上
    1. 如果是在restart point之后启动的持久化事务，将该事务的持久化内容直接删除
1. 从restart point开始解析日志，一直解析到用户传入的last position，才开始传输LCR


### 4.6 持久化

#### 4.6.1 系统表结构

YSTREAM_SERVER$：存储YSTREAM_SERVER的状态和Checkpoint

```
CREATE TABLE YSTREAM_SERVER$
(
    ID             BINARY_INTEGER      NOT NULL,
    NAME           VARCHAR(32)         NOT NULL,
    STATUS         BINARY_INTEGER      NOT NULL, // 枚举值，0：UNUESD   1：INITED   2：RUNNING   3：STOPPED   4：ABORTED
    OP_VERSION     BINARY_BIGINT       NOT NULL, // 操作版本号，每次持久化操作必然修改该字段，该字段+1，用于备库转发持久化操作时，异常情况下的可重入判断

    CREATE_TIME    TIMESTAMP           NOT NULL,
    START_TIME     TIMESTAMP           NOT NULL, // 最近一次启动时间
    STOP_TIME      TIMESTAMP           NOT NULL, // 最近一次停止时间
    START_SCN      BINARY_BIGINT       NOT NULL, 
    START_POINT    VARCHAR(32)         NOT NULL, // 根据start scn找到的redo pack，对应的point

    OLDEST_SCN     BINARY_BIGINT       NOT NULL,
    OLDEST_POINT   VARCHAR(32)         NOT NULL,
    RESTART_SCN       BINARY_BIGINT       NOT NULL,
    RESTART_POINT     VARCHAR(32)         NOT NULL,
    RESTART_POSITION  VARCHAR(64)         NOT NULL,
    CAPTURE_SCN       BINARY_BIGINT       NOT NULL,
    CAPTURE_POINT     VARCHAR(32)         NOT NULL,
    CAPTURE_POSITION  VARCHAR(64)         NOT NULL,
    APPLIED_SCN       BINARY_BIGINT       NOT NULL,
    APPLIED_POSITION  VARCHAR(64)         NOT NULL，
    
    TABLE_NAMES   CLOB, // 指定的表名
    SCHEMA_NAMES  CLOB  // 指定的scheme名
) SYSTEM 88 ORGANIZATION HEAP
/
```

YSTREAM_METADATA_TAB$

```
CREATE TABLE YSTREAM_METADATA_TAB$
(
    SERVER_ID      BINARY_INTEGER      NOT NULL,
    META_VERSION   BINARY_BIGINT       NOT NULL, // 预留字段，元数据版本
    OBJ#           BINARY_BIGINT       NOT NULL, // 表的object id
    TYPE           BINARY_INTEGER      NOT NULL,
    ...... 其余的与4.3.2章节的字段一致
) SYSTEM 88 ORGANIZATION HEAP
/
CREATE UNIQUE INDEX I_YSTREAM_METADATA_TAB1 ON YSTREAM_METADATA_TAB$(SERVER_ID)
/
```

YSTREAM_METADATA_COL$

```
CREATE TABLE YSTREAM_METADATA_COL$
(
    SERVER_ID      BINARY_INTEGER      NOT NULL,
    META_VERSION   BINARY_BIGINT       NOT NULL, // 预留字段，元数据版本
    OBJ#           BINARY_BIGINT       NOT NULL, // 枚举值，0：TABLE元数据，1：COL元数据
    TYPE           BINARY_INTEGER      NOT NULL, // 表的object id
    LGM_PRIMARY_KEY         BOOL       NOT NULL, // 这一列是否属于logminer的where条件列，即logminer的主键  
    ...... 其余的与4.3.2章节的字段一致
) SYSTEM 88 ORGANIZATION HEAP
/
CREATE UNIQUE INDEX I_YSTREAM_METADATA_COL1 ON YSTREAM_METADATA_COL$(SERVER_ID, OBJ#)
/
```

YSTREAM_PARAMETER$

```
CREATE TABLE YSTREAM_PARAMETER$
(
    SERVER_ID      BINARY_INTEGER      NOT NULL,
    NAME           VARCHAR(64)         NOT NULL,
    VALUE          VARCHAR(64)         NOT NULL,
    DEFAULT        VARCHAR(64)         NOT NULL
) SYSTEM 88 ORGANIZATION HEAP
/
```

YSTREAM_SPILL_DATA$

```
CREATE TABLE YSTREAM_SPILL_DATA$
(
    SERVICE_ID          BINARY_INTEGER      NOT NULL,
    XID                 BINARY_INTEGER      NOT NULL, // 事务xslot
    TXN_START_SCN       BINARY_BIGINT       NOT NULL, // 事务启动scn。由于commit的事务，在客户端apply前也会持久化，所以有可能xslot重复，不能仅仅靠xslot去唯一区分不同事务，所以还需结合scn
    SEQUENCE#           BINARY_INTEGER      NOT NULL, // LCR的序列号，从1开始，每产生一个LCR，该值加一。该值可以用来识别已经持久化的LCR
    SSN                 BINARY_INTEGER      NOT NULL, // DML，LOB的ssn
    IS_CHUNK            BOOLEAN             NOT NULL, // 是不是lob块
    CHUCK_START_SEQ#    BINARY_INTEGER      NOT NULL, // 对于DML，表示最近一批LOB块的第一个SEQUENCE#。前面没有LOB块，则该值为0。该值是为了快速查找DML的lob列
    POSITION            VARCHAR(64)         NOT NULL, // 该LCR的16进制的字符串
    DATA                BLOB                NOT NULL  // 持久化的二进制数据，可能是一行DML，也可能是一个LOB块
) SYSTEM 88 ORGANIZATION HEAP
/
CREATE UNIQUE INDEX I_YSTREAM_SPILL_DATA1 ON YSTREAM_SPILL_DATA$(SERVER_ID, XID，TXN_START_SCN)
/
```

YSTREAM_SPILL_DATA$

```
CREATE TABLE YSTREAM_SPILL_TXN$
(
    SERVICE_ID          BINARY_INTEGER      NOT NULL,
    XID                 BINARY_INTEGER      NOT NULL,
    START_SCN           BINARY_BIGINT       NOT NULL,
    START_POSITION      VARCHAR(64)         NOT NULL,  // XACT_BEGIN对应的position
    SPILL_SEQUENCE#     BINARY_BIGINT       NOT NULL,  // 最后一个持久化LCR的SEQUENCE#  注意：这个值只能增加不能减少，即使做了rollback to savepoint，删除了部分LCR，该值也不能减少
    SPILL_SSN           BINARY_INTEGER      NOT NULL,  // 最后一个持久化LCR的SSN
    RESTART_POINT       VARCHAR(32)         NOT NULL,  // 重启后，该事务的解析恢复的起始RdPoint，从该点开始解析，不会重复解析已经持久化的LCR，也不会漏掉未持久化的LCR
    RESTART_LSN         BINARY_BIGINT       NOT NULL,  // 重启后，该事务的解析恢复的起始LSN
    RESTART_RECORD      BINARY_INTEGER      NOT NULL,  // 重启后，该事务的解析恢复的起始的record offset
    COMMIT_SCN          BINARY_BIGINT       NOT NULL   // 如果该事务已提交（解析到XACT_END），则该值不为0。未提交的事务，该值为0
) SYSTEM 88 ORGANIZATION HEAP
/
CREATE UNIQUE INDEX I_YSTREAM_SPILL_TXN1 ON YSTREAM_SPILL_TXN$(SERVER_ID, XID，START_SCN)
/
```

#### 4.6.2 各个系统表的持久化场景

##### YSTREAM_SERVER$的操作场景

1. CREATE，START，STOP，DROP，ADD_TABLES等操作会立刻修改
1. 更新Checkpoint数据
1. 任何持久化操作的事务内，都会修改YSTREAM_SERVER$.OP_VERSION


##### YSTREAM_PARAMETER$的操作场景

1. YSTREAM CREATE时，初始化参数列表
1. 设置参数时


##### YSTREAM_METADATA_TAB$，YSTREAM_METADATA_COL$的操作场景

1. YSTREAM CREATE时，初始化表元数据，并持久化
1. 如果元数据自上一次Checkpoint以来发生过变化，下次更新Checkpoint数据时会更新元数据


##### YSTREAM_SPILL_DATA$，YSTREAM_SPILL_TXN$

1. 需要溢出长时间不提交的事务
1. 需要溢出大数据量的事务
1. 对溢出事务进行commit，rollback或rollback to savepoint
1. applied point更新后，清理无用的持久化事务
1. 重启恢复时，清理重复的溢出事务（后续在Checkpoint会详细解释）


#### 4.6.3 元数据持久化细节

YSTREAM  CREATE执行时：

1. 通过闪回查询，查到所有符合条件的表的元数据
1. 将每个符合条件的表，存到YSTREAM_METADATA_TAB$，对应的列，存到YSTREAM_METADATA_COL$


持久化Checkpoint时：

1. 元数据是给日志解析用的，而重启恢复是从restart point开始解析，所以  **持久化的元数据，其版本要对应restart point**
1. 每隔一段时间，会生成一个RestartPoint，每个RestarPoint，对应元数据的版本不一样
1. 需要进行元数据在内存中的多版本控制，以便能再Checkpoint确定一个restart point之后，去更新YStream系统表的元数据
1. 为了实现上述功能，需要对每个表的元数据变更进行记录，在restart point写入系统表的时候，把它对应的元数据变更也写入系统表


![](https://pingcode.yasdb.com/atlas/files/public/67396d5aa1ad9a3311dc90af/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

- 搞一个元数据变更队列，这个队列是mctx管理，追加写，只要内存够就没有上限
- 只要解析到表的DDL，就把  **变更内容挂在这个队列**  上（DDL变更也会发给客户端，所以直接copy这个内容即可）
- 执行Checkpoint时，从队头开始，  **依次将变更记录写入系统表**  ，直到选定的restart point为止，以上图为例：
    - 选定restart point为2，则把前2条变更记录写入系统表；
    - 选定restart point为3，则把这5条变更记录写入系统表；
    - 选定restart point为1，则什么都不写
- Checkpoint执行完后，  **将已经写入系统表的变更记录从队头摘掉**


mctx的内存释放方案：

1. 把现有的队列数据往前memmove，然后mctxTruncate掉后面的页面
1. 新增一个mctxFreeHeadBlocks函数，把队头的空闲页面还给mpool
1. 新申请一个mctx，所有数据拷贝到新的mctx后，释放原来的


#### 4.6.4 溢出事务持久化细节

当某个事务满足溢出条件后，溢出流程如下：

1. 将该事务在内存里缓存的所有LCR，依次插入YSTREAM_SPILL_DATA$。其中每个DML一行，每个LOB块（最多8K大小）一行
1. 更新YSTREAM_SPILL_TXN$中该事务的信息，包括 SPILL_SEQUENCE#，SPILL_SSN，RESTART_POINT，RESTART_LSN，RESTART_RECORD 
1. Commit
1. 删除内存里所有LCR，更新内存中该事务的信息


当溢出事务解析到commit后：

1. 把内存里剩余所有LCR都持久化到YSTREAM_SPILL_DATA$ （这么做是为了发送逻辑统一，要么都从系统表读，要么都从内存读。虽然发送性能会有损失，后期有空再细化）
1. 更新YSTREAM_SPILL_TXN$中该事务的commit scn
1. Commit
1. 删除内存里所有LCR，更新内存中该事务的信息
1. 挂到提交队列上


当溢出事务需要发送时：

1. 从系统表按SEQUNCE#顺序扫描每一行
1. 如果是DML，且DML不带行外存储的LOB，直接发送
1. 如果是LOB，则先跳过
1. 如果是带行外LOB的DML，则
    1. 发送该DML
    1. 从DML所记录的LOB_START_SEQUNCE#开始重新扫描系统表
    1. 遇到相同lob id的LOB，则发送，否则跳过
    1. 直到LOB区域扫描结束（遇到一个非LOB的行）
1. 最后发送commit


溢出事务清理，只能等applied point大于commit，在Checkpoint触发后检查，满足条件就清理

#### 4.6.5 备库转发

- 通过内部HA链路，发送需要持久化的数据，以及OP_VERSION给主库
- 在主库执行相应的系统表操作
    - 主库执行成功，返回success ACK
    - 执行失败，返回Error ACK
- 备库接收到success，则返回
- 备库接收超时，使用相同OP_VERSION重试
    - 如果主库发现该OP_VERSION已经提交，则直接返回success ACK
    - 否则再次执行系统表操作
- 备库重试超过3次都失败，则备库解析停止，并报错


### 4.7 并行解析

现有logminer是单线程的，解析瓶颈主要在线程的record解析上，为此需要把单线程解析逻辑优化为多线程解析。

![](https://pingcode.yasdb.com/atlas/files/public/67396d5a8970c2af4f52123c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

![](https://pingcode.yasdb.com/atlas/files/public/67396d5a8970c2af4f52123d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

主线程调用lgmFetch函数，lgmFetch执行如下操作：

- 如果没有待解析的Redo pack，则加载一批redo pack
- 扫描所有redo pack
- 扫描每个redo pack里的group
- 先遍历该group里的record，看有没有重启数据库的record
    - 如果有，则  **等待所有后台线程全部完成解析**  ，然后把结果队列里的数据pop完成
    - 单线程解析这个group
- 将该group  **按handler id哈希分配**  到某个后台线程，只需要把group的指针挂到后台线程的  **解析队列**  里
    - 后台线程的解析队列队列长度为1024，超过则需要主线程先线程下次重试分配
- 扫描后台线程的  **结果队列**
    - 需要按照LSN的顺序去扫描结果队列
    - 当每个LSN内的所有结果pop完毕后，在切到下一个LSN
    - 只要结果队列连续，则尽量pop，直到所有结果队列为空，或者结果不连续


后台线程逻辑：

- 从解析队列pop一个group
- 解析该group的所有record
    - 如果record有数据，则将LCR push到结果队列
    - 结果队列的最大长度是2M，如果空间满了，则解析暂停，等待主线程pop完所有数据，然后把结果队列的offset重置为0
    - 如果一个LCR的长度超过2M，则不再copy到结果队列，直接等待主线程从解析堆栈fetch数据（与现有单线程逻辑一致）


redo buffer，结果队列的buffer，由于是连续内存，不能从Stream pool获取，需要malloc

并行度最大为128

### 4.8 服务端协议

  [消息具体结构](https://conf.yasdb.com/pages/viewpage.action?pageId=144143577)  

|Logiclog cmd|value|作用|备注|
|:---|:---|:---|:---|
|NONE|0|无效值|  
|
|ATTTACH,,ATTACH_ACK|1,2|API绑定到一个LogMiner Server，以便开始接收逻辑日志。消息包含 LogMiner Server name，lastPosition等等|1. position的长度=22字节
1. 首次attach时，可以用scn2position转换scn为position
1. 断点续传attach时，传入最后一次成功接收的position
|
|DETACH|3|API与LogMiner Server解绑|  
|
|DML|4|一条DML，与LogMinerDML结构相似，需要补充一下额外信息|1. 对应RowLCR类
1. 带position
1. 为了节省网络IO，小事务的DML封装了事务BEGIN和COMMIT。
|
|CHUCK|5|LOB等，这个一定DML后面|1. 对应ChunkLCR类
1. 带position
1. 需要客户端组装
|
|DDL|6|除了SQL Text，还要包含对应的元数据，包括DDL类型，表和列的属性（被该DDL影响的元数据）。|1. 对应DdlLCR类
1. 带position，schema，以及表变更的METADATA
|
|METADATA|7|attach之后，会把元数据先同步给客户端，初始化客户端元数据。后续遇到DDL逻辑日志，也会封装DDL逻辑日志内部，用于更新元数据。|1. 初始化时，带表名，所有列的元信息
1. 解析DDL时，带表名，受影响列的元信息
|
|CKPT，CKPY_ACK|8,9|同步服务端checkpoint，收到后返回applied position|  
|
|XACT|BEGIN30、    
  COMMIT31、    
  ROLLBACK32、    
  SAVEPOINT33、    
  ROLLBACK_TO_SAVEPOINT34|BEGIN，COMMIT. 如果提前发送大事务，还会有ROLLBACK，SAVEPOINT，ROLLBACK_TO_SAVEPOINT|1. 小事务不会发送BEGIN，COMMIT，而是在DML上附带事务信息，减少网络IO
1. 一旦发送BEGIN，必然后COMMIT或ROLLBACK
1. SAVEPOINT用ssn表示回滚位置
|


#### 消息交互流程

![](https://pingcode.yasdb.com/atlas/files/public/67396d5aa1ad9a3311dc90b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQkVBQUFBQUFBQUFBSUFBQUFnQ0FBQURBRUFDQUFCQUFDQUFBQUFJQUFBQUFBQUFBQUFBU0FBQUNBQkFDZ0JBQUFrQUFvQUFBRUFBQUFBQUFBQUFBQUNBQUFDQUFBQUlBUUFBQUFBQUFBQUJBQUFBQUlBQ0FBQWdBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQWdBQUFvQkJCQVFHQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2MzAsImV4cCI6MTc4MjMxODQzMH0.bpwKC7YeBatAXqEpGhoieSK3kF8iXJizhMTUovzUg70)

1. JDBC connect数据库
1. 发送attach命令，绑定到一个LogMiner Server
1. 服务端发送元数据，客户端缓存一下
1. 服务端开始发送事务LCR
1. 客户端根据元数据，反序列化DML
1. 服务端定期同步CKPT给服务端，客户端返回ACK，以便服务端了解客户端进度。比如每3秒同步一次CKPT
1. 服务端空闲时，会定期发送CKPT作为心跳，保活链路
1. 如果网络断连，客户端需要重新attach，并传入最近一次position，从该断点


### 4.9 角色与权限

增加一个逻辑日志解析的权限YSTREAM_CAPTURE，只有赋予该权限的用户，才可以通过API连接和执行高级包

### 4. 10特性可维可测设计

1. 动态视图：
1.     - V$LOGMINER_SERVER：显示所有Logminer Server的状态，包括运行状态，启动时间，当前进度，checkpoint
    - V$LOGMINER_STAT：显示所有Logminer Sever的统计信息，包括send大小，解析大小，溢出事务大小等

1. 系统视图    

1.     - ALL_LOGMINER_EVENTS：显示Logminer Server的事件，包括启动，关闭，修改过滤条件等
    - ALL_LOGMINER_PARAMETERS：逻辑日志接卸相关参数
    - ALL_LOGMINER_TABLES：显示所有需要解析的表名，由用户设置



### 4.11 特性安全设计

1. 网络连接认证：利用JDBC的能力做连接认证
1. 加密传输：利用JDBC的能力做SSL加密
1. 权限：增加一个逻辑日志解析的权限YSTREAM_CAPTURE，只有赋予该权限的用户，才可以通过API连接和执行高级包
1. 加密表空间的溢出事务：加密表空间的事务溢出时，需要加密后再插入系统表


### 4.12 特性周边配合

### 兼容性

1. 系统表兼容性：增加了若干系统表，需要加升级脚本
1. 协议兼容性：高版本YashanDB兼容低版本API，在连接时确认两者版本号，后续  **消息协议以低版本为主**
1. 大小端：YashanDB和API客户端支持在大小端不同的机器上


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|序号|用例类型|用例内容|预期结果|实际结果|
|:---|:---|:---|:---|:---|
|1|DML|insert...|  
|  
|
|  
|  
|lob...|  
|  
|
|  
|  
|大事务|  
|  
|
|  
|  
|长事务|  
|  
|
|  
|  
|update...|  
|  
|
|  
|  
|delete...|  
|  
|
|  
|DDL|创建表|  
|  
|
|  
|  
|表结构相关|  
|  
|
|  
|  
|约束相关|  
|  
|
|  
|  
|索引相关|  
|  
|
|  
|  
|增减表相关|  
|  
|
|  
|  
|重命名表相关|  
|  
|
|  
|  
|模式相关|  
|  
|
|2|解析节点|主库解析，备库解析|  
|  
|
|  
|推进水位线|长时间不推进|  
|  
|
|  
|断点续传|服务端重启|  
|  
|
|  
|  
|主备切换，API连到新主|  
|  
|
|  
|异常相关|回退position报错|  
|  
|
|  
|  
|错误的调用顺序|  
|  
|
|  
|  
|错误入参|  
|  
|
|  
|  
|备库解析，与主库断连|  
|  
|


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

1. YStream概念
1. YStream使用示例
1. 动态视图
1. ALL视图


**新增配置参数**

STREAM_POOL_SIZE, 取值范围  0 或 [64K, 64T]，0 表示释放 pool，不启用 ystream 服务时使用。该参数可以在线通过 alter system set STREAM_POOL_SIZE = ‘100M’;  ， 当所有 ystream server 都停止时，可以缩小， 任何时候可以扩大。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-4-10_15-26-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNThhMWFkOWEzMzExZGM5MDlmIiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.zvuYxJQCXfsMH0DFNy6u6rllZVYhEqtoV0fen8Ep8jg)

 (image/png)    


[image2024-4-10_15-34-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNThhMWFkOWEzMzExZGM5MGEwIiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.oLXRsoDszKxmpnz8poU1W9lUvmR_ZwixPi6NtUZ0za4)

 (image/png)    


[image2024-4-11_16-45-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTk4OTcwYzJhZjRmNTIxMjJmIiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.T4Vxt_ieXth9ZzNBAUqE8r_7iuC8Nwt5nSSmDZEAw7k)

 (image/png)    


[image2024-4-11_16-47-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTk4OTcwYzJhZjRmNTIxMjMwIiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.969LJbXGq16hkNqKQi0NUHzgngrDocq_b42rpdrPRmY)

 (image/png)    


[image2024-4-11_21-34-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTk4OTcwYzJhZjRmNTIxMjMyIiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.vrMLP5nEPaMTSl7CzNRTPJmzE70sqUXkHgKzEWkzZYI)

 (image/png)    


[image2024-4-11_21-41-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTk4OTcwYzJhZjRmNTIxMjMzIiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.J1DvXe2KsicoKLDZOybidT27BLMxy3hqAOLwGuFW4n4)

 (image/png)    


[image2024-4-11_21-44-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTk4OTcwYzJhZjRmNTIxMjM0IiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.NQL45ix5CUR_tmqi4mAwIBOA5raBfOYwC-1djxydZjc)

 (image/png)    


[image2024-4-12_11-53-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTlhMWFkOWEzMzExZGM5MGE0IiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.HO7lnv80dWwv3B4NjeoCuwPg-2-BRB2I-so2RZudoIw)

 (image/png)    


[image2024-4-12_15-42-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTlhMWFkOWEzMzExZGM5MGE2IiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.EuNVfvw16E0kvVlcggebXK8OtSiyNeqKd71i-wrplEk)

 (image/png)    


[image2024-4-19_17-56-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNTk4OTcwYzJhZjRmNTIxMjM4IiwicmVmX2lkIjoiNjczOTZkNTg1OTNmOTljOWZmMjM3YTVkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjMwLCJleHAiOjE3ODIzOTQwMzB9.rlDOJBAnCoEfYCicZZaDwCXeVr82aFOUn18atRaLxeg)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：2024-4-16,1. 元数据管理，不用关注空洞释放。元数据使用mctx管理，内存在stop的时候一把释放
1. col元数据需要包含default value
1. 事务溢出后续按照list分区自动扩展搞
,遗留问题：,1. Checkpoint机制，元数据持久化机制后续继续讨论
,  
,Posted by mazhihong at 四月 16, 2024 16:16|
|---|
