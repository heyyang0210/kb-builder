Created by 马志宏, last modified by  朱国旭 on 六月 14, 2024

*IR链接：*    [YDBRD-26320](https://jira.yasdb.com/browse/YDBRD-26320?src=confmacro)    *-*  *实现CDC接口且支持元数据管理，事务排序*  *待内部评审*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-%E6%80%BB%E8%BF%B0)  

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

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [CDC日志解析API特性调研](/pages/createpage.action?spaceKey=YAS&title=CDC%E6%97%A5%E5%BF%97%E8%A7%A3%E6%9E%90API%E7%89%B9%E6%80%A7%E8%B0%83%E7%A0%94)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

  


|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|wiki|
|:---|:---|:---|:---|:---|:---|---|
|功能|日志挖掘|多线程并行解析Redo，输出原始LCR|是|是|--------|  [YStream服务端日志解析 特性设计](150604742.html)  |
|  
|元数据管理|解析过程中维护表的元数据|是|是|||
|  
|数据持久化|溢出事务，checkpoint和元数据的持久化|是|是|||
|  
|断点续传|重启，主备切换后从断点恢复续传|是|是|||
|  
|客户端API|接收服务端发送的LCR，提供类型转换接口|是|是|  
|  
|
|可用性|恢复场景|重启后断点续传|是|是|----|  
|
|可靠性|故障场景|主备切换后断点续传|是|是|----|  
|
|可维可测|DFX|动态视图，系统视图|否|是|----|  
|
|安全|安全场景|连接认证，加密传输，加密表空间|否|是|----|  
|
|兼容性|协议兼容|不同版本YashanDB和API协议兼容|否|否|----|  
|
|周边配合|权限|新增角色，供日志解析用|否|是|----|  
|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|CDC|Change Data Capture，数据变更捕获。CDC是一套基于识别、捕获和传播对源数据库增量变更的方案。|是|  [https://en.wikipedia.org/wiki/Change_data_capture](https://en.wikipedia.org/wiki/Change_data_capture)  |
|LCR|Logical Change Record  ，逻辑变更日志。通常是内部定义的一种中间格式，用来描述CDC捕获的数据库的增量变更|是|  [https://docs.oracle.com/en/database/oracle/oracle-database/23/xstrm/general-xstream-concepts.html#GUID-71F649DC-F09A-4B5B-BB1C-4325871E3AEE](https://docs.oracle.com/en/database/oracle/oracle-database/23/xstrm/general-xstream-concepts.html#GUID-71F649DC-F09A-4B5B-BB1C-4325871E3AEE)  |
|Logminer|Oracle的一个组件，可以使用视图查询在线和存档的重做日志文件内容，查询结果是SQL语句|  
|  [https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/oracle-logminer-utility.html#GUID-3417B738-374C-4EE3-B15C-3A66E01AE2B5](https://docs.oracle.com/en/database/oracle/oracle-database/19/sutil/oracle-logminer-utility.html#GUID-3417B738-374C-4EE3-B15C-3A66E01AE2B5)  |
|  
|  
|  
|  
|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

不涉及。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-%E6%8E%A5%E5%8F%A3)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|高级包    
    
    
|DBMS_LOGIC_STREAM.  CREATE(server_name, connect_user  )|创建一个logminer server，指定server名字，指定要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。仅写入系统表，不启动Logminer server线程。  connect_user表示允许连接的user名字|是    
    
    
|
||DBMS_LOGIC_STREAM.ADD_TABLES(  server_name,   table_names, schemas)|添加要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。可在Logminer Server运行时执行，如果不指定，则解析所有表。||
||DBMS_LOGIC_STREAM.DROP_TABLES(  server_name,   table_names, schemas)|删除要解析的表名，也可指定要解析的schema，只有被指定的表才会被解析。||
||DBMS_LOGIC_STREAM.  SET_PARAMETER(server_name, parameter, value)|设置Logminer相关的参数||
||DBMS_LOGIC_STREAM.START(  server_name,   start_scn)|启动日志解析，start scn如果为NULL，则从当前scn开始||
||DBMS_LOGIC_STREAM.STOP(  server_name  )|停止日志解析||
||DBMS_LOGIC_STREAM.DROP(  server_name)|删除logminer server||
|系统视图|ALL_LOGMINER_EVENTS|显示Logminer Server的事件，包括启动，关闭，修改过滤条件等|是    
    
|
||ALL_LOGMINER_PARAMETERS|逻辑日志接卸相关参数||
||ALL_LOGMINER_TABLES|显示所有需要解析的表名，由用户设置||
|动态视图|V$LOGMINER_SERVER|显示所有Logminer Server的状态，包括运行状态，启动时间，当前进度，checkpoint|是|
||V$LOGMINER_STAT|显示所有Logminer Sever的统计信息，包括send大小，解析大小，溢出事务大小等||
|客户端API    
  **jar名字：yas_stream.jar**    
    
,  
,  
,  
|getClient(): YasCdcClientBoot|获取CDC客户端实例|是    
    
    
    
|
||open(YasCdcConfig): void|打开CDC客户端||
||next(): AbstractLogMinerResult|读取一条CDC解析后结果||
||close():   void|关闭CDC客户端||
|YasCdcConfig|builder(): Builder<T>|获取YasCdcConfig的Builder<T>，用于构造YasCdcConfig|是|
|  
|setCheckpointManager(CheckpointManager): Builder<T>|设置检查点序列化/反序列化方法。调用者实现该接口，客户端即会定期序列化检查点，并在恢复时将检查点反序列化||
|  
|setDeserializer(Deserializer<T>): Builder<T> |设置反序列化方法。调用者实现该接口，客户端即会将AbstractLogMinerResult转换为调用者需要的结构||
|AbstractLogMinerResult|LogMinerDdl|DDL实体类|是    
    
    
    
    
|
||LogMinerDml|DML实体类||
||LogMinerChunk|大对象实体类||
||LogMinerXact|事务标识实体类||
||LogMinerCkpt|检查点实体类（不会在next的返回值获取，用作断点续传）||
|LogMinerDdl|getDdlType():DdlType|获取DDL类型|是    
    
    
    
    
    
    
|
||getObjectId():long|获取对象id||
||getObjectType():ObjectType|获取受影响的对象||
||getTableName():String|获取所属的表名||
||getDdlText():String|获取DDL的SQL文本||
||getSchemaName():String|获取所属的模式名||
||getMetadata(): Metadata（可不对外暴露）|获取元数据修改信息（作为SQL的补充）||
|LogMinerDml|getObjectId():long|获取表对象id|是    
    
    
    
    
    
    
    
|
||getTableName():String|获取表名||
||getSchemaName():String|获取模式名||
||getDmlType():DmlType|获取DML类型||
||getNewValues():Object[]|获取更新后的值，delete类型将返回null||
||getOldValues():Object[]|获取更新前的值，insert类型将返回null||
||hasChunkData():boolean|该条dml是否包含大对象||
||getScn():LogMinerScn|获取该条dml的唯一标识信息||
|LogMinerChunk|getObjectId():long|获取表对象id|是    
    
    
    
    
    
    
    
    
    
|
||getTableName():String|获取表名||
||getSchemaName():String|获取模式名||
||getColId():int|获取列id（非数据库的colId，是对应前述DML中的一个自增id）||
||getOffset():long|获取该片chunk起始位置相对整个值的偏移量||
||getSize():long|获取该片chunk的大小||
||isEmpytChunk();boolean|判断该chunk是否是EMPTY，注意并非是null||
||isEndOfRow():boolean|判断是否是上述DML中的最后一个Chunk||
||isLastChunk():boolean|判断该片chunk是否是是整个chunk的最后一个片||
||getScn():LogMinerScn|获取该条dml的唯一标识信息||
|LogMinerXact|getXactType():XactType |获取该事务标识的类型|是|
|LogMinerCkpt|defaultSerialize(LOG_MINER_CKPT):byte[]|默认的序列化方式|是    
    
    
|
||defaultDeserialize(byte[] ckpt):LOG_MINER_CKPT|默认的反序列化方式||
|Metadata|getTable(long objectId):Table|获取表信息|是    
    
|
||……|  
||
|Table|getColTypes():List<ColType  >|获取列类型|是    
    
    
    
    
|
||getColNames():List<String>|获取列名||
||getTableName():String|获取表名||
||getTableSchema():String|获取模式名||
||getColSize():int|获取列数大小||
||……|  
||
|ColType|int、char、blob ……|枚举|是|
|DdlType|alterTable、createTable ……|枚举|是|
|ObjectType|table、package、index ……|枚举|是|
|LogMinerScn|compareTo(LogMinerScn o):int|比较唯一标识打大小信息，大于则返回正，否则返回负|是    
    
|
||getScn():byte[]|获取其Scn的二进制表示形式||
|DmlType|insert、update、delete|枚举|是|
|XactType|start、commit、savePoint、rollback|枚举|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**规格：**

1. 最多可以启动32个Logminer Server
1. LogMiner Server名字最大长度32
1. 最大支持配置10000张表，100个schema，也可以配置为所有表
1. 仅支持单机主备


**约束：**

1. where条件列不包含LOB列或者LOB格式存储的类型（如8K以上的varchar）
1. DBMS_LOGIC_STREAM的函数（除START，STOP）只能在主库上执行
1. 一个LogMiner只能同时和一个客户端连接
1. 一个主备组里，不能在多个实例上启动同一个Logminer
1. 不支持UDT类型的表
1. 不支持XML，JSON类型的列
1. 只支持部分DLL（资料中体现白名单）
1. 所有事务要在提交后发送，不支持大事务提前发送


  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-%E7%89%B9%E6%80%A7)  

### 架构对比

|  
|方案一|方案二|方案三|方案四|
|:---:|:---:|:---:|:---:|:---:|
|  
|||||
|友商相似方案|Oracle Xstream|达梦，PG|  
|OceanBase，TiKV|
|对源库性能影响|较大|一般|一般|一般|
|网络流量|最小，仅传输提交事务，且可以过滤不需要的表数据|较小，可以过滤不需要的表数据|较大，Redo大小至少是LCR的2倍|较大，Redo大小至少是LCR的2倍|
|API易用性|较高，客户端无需关心大事务溢出，checkpoint逻辑简单|一般，需要考虑大事务溢出持久化配置|一般，需要考虑大事务溢出持久化配置|较低，需要部署额外的解析工具进程|
|解析性能|较高，C语言优势，大事务持久化有索引和分区加速|一般|较低|较低|
|逻辑备库演进|工作量较少，备库只需要实现事务入库|工作量一般，备库需要考虑将大事务持久化到系统表|低版本备库不兼容高版本主库的Redo，场景受限|逻辑备库依赖于解析工具，部署和管理不方便|
|共享集群适配|适配工作量小，多实例间事务保序易实现，有Oracle方案参考|适配工作量一般，API需要汇聚多实例LCR进行事务重排|适配工作量一般，API需要汇聚多实例LCR进行事务重排|适配工作量一般，解析工具需要汇聚多实例LCR进行事务重排|
|分布式适配|适配工作量较大，需要汇聚所有DN的LCR并对分布式事务重排序|适配工作量较大，需要汇聚所有DN的LCR并对分布式事务重排序|适配工作量较大，需要汇聚所有DN的REDO，解析后并对分布式事务重排序。API端压力较大|适配工作量较大，解析工具需要汇聚所有DN的REDO，解析后并对分布式事务重排序。API端压力较小|


#### 本文档倾向于方案一

  


#### 基本架构



#### Flink适配示意图



#### 组件图

![](https://conf.yasdb.com/download/attachments/144143577/image2024-3-4_22-20-7.png?version=1&modificationDate=1709562008000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM4NTAsImV4cCI6MTc4MjMxNDY1MH0.glMfM-bGMU7ESOe4Jos8-9ZqLWDJ2i-RNjLLVJzV8L0)

### 4.1 日志挖掘

复用现有logminer C接口代码，现有C接口的TPCC业务解析速度为25M/s（对应90M/s的redo，接近40万tpmc），需要现有  代码进行一定的  改造，提升性能：

1. 优先  **从Redo cache读**  日志，减少磁盘IO
1. **采用双buffer**  ，一个buffer用来读下一批redo，另一个buffer用来解析当前redo
1. 多线程  **并行解析record**  ，将record按session哈希到不同线程，提高解析速度


### 4.2 内存管理

日志解析，事务组装，元数据缓存都需要申请内存，其中事务组装占大头，内存占用空间可达在几百M。这些内存需要考虑淘汰和复用，尽可能减少对数据库的影响，需要有一套内存管理机制。

新增参数  **STREAM_POOL_SIZE**  （默认值为0），表示逻辑日志解析需要的内存池。该参数可以  **立即生效**  ，在内存里malloc一片内存，供所有的Logminer Server使用



- Stream Pool有多块Chuck组成，每个Chunk是一片连续的内存
- 支持动态扩展，当STREAM_POOL_SIZE设置成更大的值时，增量malloc一块Chuck，追加到stream pool里，不影响正在进行的日志解析
- Stream Pool的每个页面大小为32K
- Stream Pool有两条链，usedList和freeList，空闲的页面挂在freeList上


日志解析，事务组装，元数据缓存都以页面为单位，从freeList申请内存，不用时，将页面归还到freeList上。

### 4.3 元数据管理

初始化：根据用户指定要解析的表以及  **起始scn**  ，通过  **闪回查询系统表**  ，得到起始scn对应的表的元数据。

增量更新：在表相关的DDL的  **逻辑日志里，附加元数据的增量变更信息**  （可以从def和dc里获取）。解析过程中，遇到DDL的日志，则从逻辑日志里得到变更的元数据，更新当前元数据缓存。

元数据缓存：drop table或drop column释放元数据空间，并且空洞达到一定阈值后进行shrink，将空闲页面归还到Stream Pool

持久化：如果每次重启都通过闪回查询重建元数据，可能会有  **快照太旧**  的风险，所以元数据也需要持久化，具体时机为执行checkpoint时，如果元数据相比上一次checkpoint有变更，则进行持久化

|表相关元数据|  
|列相关元数据|  
|
|---|---|---|---|
|OBJ#|object id|COLUMN_ID|列ID|
|OWNER|所有者|COLUMN_NAME|列名|
|TABLE_NAME|表名|DATA_TYPE|类型|
|TABLE_TYPE|表类型|DATA_PRECISION|精度|
|FLAGS|  
|DATA_SCALE|  
|
|COLS|列数|DATA_LENGTH|  
|
|VCOLS|  
|CHAR_USED|  
|
|VERSION|版本|CHAR_LENGTH|  
|
|  
|  
|FLAG|判断是否将varchar按lob存储|
|  
|  
|  
|  
|


### 4.4 数据持久化

为了实现重启，主备切换后的断点续传，需要对一些数据进行持久化，包括  **Checkpoint，溢出事务，元数据**

|  
|方案|优势|劣势|
|---|:---:|:---:|:---:|
|1|持久化到系统表|1. **支持事务**  ，无需关心双写和原子性
1. 可利用  **索引加速**  查找数据（如搜索溢出事务）
1. 备库自动同步，支持主备切换
1. 客户端高可用容易实现
|1. 备库上执行CDC，无法记录系统表，  **需要转发给主库**  ，  **逻辑比较复杂**  ，应对的异常情况较多（比如备库回放慢，网络断连等）
1. **大事务太多时影响源库**  ，占用很多sysaux表空间
1. 主库不可用时，无法持久化（如沙箱备库场景）
|
|2|持久化到客户端本地文件,（由API内部逻辑持久化，客户端应用不感知）|1. **不占用数据库资源**
1. 支持数据库主备切换
|1. 需要API实现一套文件持久化逻辑，解决  **双写和原子性问题**
1. 客户端可用性降低
|
|3|持久化到客户端本地文件,（API只提供接口，由客户端读取和持久化）|1. **不占用数据库资源**
1. **工作量小**  ，因为持久化逻辑由客户端应用实现
1. 支持数据库主备切换
|1. 对客户端应用有额外工作量，  **易用性较差**
1. 客户端可用性降低
|
|4|持久化到数据库本地文件|1. 备库可以直接写本地
1. 不产生redo，不影响HA组内其他实例
|1. 不支持主备切换
1. 需要注意双写和原子性问题
1. 残留数据管理麻烦
|


方案4最先排除，缺点比较明显。在方案1和方案2里，更倾向  **方案1**  ，主要原因如下：

1. 大事务溢出属于小概率场景
1. 系统表实现简单，性能好，定位问题也方便
1. 与Oracle Xstream持久化方案一致


方案1的缺点是占用源库资源，主库不可用时，备库CDC无法持久化。为了解决这两个缺点，我觉得可以  **同时支持方案3**  ，因为API本来就会同步Checkpoint和元数据，所以工作量不大，只需要实现大事务提前发送即可。

方案一需要的持久化表空间，与oracle保持一致，默认在SYSAUX。oracle在logminer解析时可以指定为用户表空间，我们也可以  **考虑指定到用户表空间**

结论：  **YashanDB同时支持方案1和方案3，用户自行选择其一**  。但方案3暂时不做，因为交付周期比较紧张，后续有需求再做

#### 方案一关键内容

##### 涉及的系统表：

LGM_SERVICE$：所有Logminer Server的名字，运行状态，Checkpoint点等。

LGM_METADATA$: 元数据的持久化。

LGM_SPILL_TXN$: 溢出事务的事务信息。

LGM_SPILL_DATA$: 溢出事务的DML数据。

LGM_PARAMETER$: Logminer Server的参数。

##### 备库转发：

转发流程：通过  **主备内部链路**  的协议，发送需要持久化的数据到主库，主库执行系统表插入。主库完成操作后，备库不需要立刻等待回放同步，只有当备库需要读持久化数据的时候，才需要等待主备同步。

操作去重：备库转发失败后会做重试，但是主库可能已经提交，需要去重。在LGM_SERVICE$上增加一个持久化version，每次持久化任何数据时，在  **同一个事务内增加该version**  。备库转发重试时，发现version已更新，则跳过。

网络异常：主备网络异常，备库转发失败后，会进行一段时间的  **重试**  。重试到达参数指定的上限后，报错停止解析。此外，  **Checkpoint的转发异常不会阻塞逻辑日志解析**  。

  


### 4.5 事务组装

为了提高API易用性，Logminer Server向API输出的数据是按照事务顺序排序，并且只发送提交的事务。

事务组装模块，有两个链表，分别存放活跃事务LCR和提交的事务LCR。



活跃事务队列结构是个以xid为索引的hash桶，以便在追加DML时，更快找到对应的事务

#### 事务组装

提交事务队列是个有序链表，按事务提交顺序排序

1. 解析到事务begin，则向活跃事务队列添加一个节点
1. 解析到DML，DDL，找到对应的事务，将数据追加到该事务缓存中
1. 解析到rollback savepoint，则从活跃事务队列里，删除savepoint点之后的数据
1. 解析到rollback，则从活跃事务队列里摘除
1. 解析到commit，则将活跃事务缓存，移到提交事务队列上


#### 提交事务的淘汰

当客户端返回applied scn后，将小于该scn的提交事务从队列里删除，同时将对应的溢出LCR从系统表里删除

### 事务溢出处理

两种事务需要考虑溢出：

1. 长时间不提交的事务，这种会阻塞checkpoint，需要持久化来推进checkpoint，减少重启恢复时间，保证归档日志可清理
1. 大数据量事务，这种事务会占用大量内存，需要持久化释放内存


长事务和大事务的溢出条件分别由Logminer参数txn_age_spill_threshold、txn_lcr_spill_threshold控制

#### 大事务溢出

解析到DML的LCR后，在追加到事务缓存后，判断该事务内已缓存的LCR总大小，如果超过txn_lcr_spill_threshold的值，则将缓存中的LCR一行行插入系统表，插入成功后，并从buffer删除已经持久化的LCR

并在该事务状态里标记溢出的LCR数量

#### 长事务溢出

解析到DML的LCR后，在追加到事务缓存后，判断该事务启动时间，如果超过txn_age_spill_threshold的值，则将缓存中的LCR一行行插入系统表，插入成功后，并从buffer删除已经持久化的LCR

并在该事务状态里标记溢出的LCR数量

#### 溢出事务的rollback

1. 对于rollback savepoint，如果该事务有溢出的LCR，则需要扫描系统表，将savepoint之后的溢出LCR delete
1. 对于rollback，直接删除该事务所有的溢出LCR


#### 系统表加速

对于溢出事务，Oracle使用TXN_ID来做分区，每个事务一个分区（需要先支持List分区，YashanDB暂未实现，用TXN_ID作为索引，加速查找）

### 4.6 客户端API

API接口使用java开发，以jar包形式提供给客户。API引用JDBC，可以使用JDBC的连接和数据类型转换能力

### 协议

1. 消息头采用CsPacketHead，新增CsCommand ：CMD_LOGIC_LOG，表示逻辑日志的消息类型，消息体的开头1字节表示逻辑日志消息子类型，后面才是消息内容。
1. 对于DML的每一列数据，其类型和结构与JDBC兼容，可以复用JDBC的能力去解析。比如INT，STRING，NUMBER的类型ID，存储结构与JDBC的定义相同。




  [消息具体结构](https://conf.yasdb.com/pages/viewpage.action?pageId=144143577)  

|Logiclog cmd|value|作用|备注|
|---|---|---|---|
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



1. JDBC connect数据库
1. 发送attach命令，绑定到一个LogMiner Server
1. 服务端发送元数据，客户端缓存一下
1. 服务端开始发送事务LCR
1. 客户端根据元数据，反序列化DML
1. 服务端定期同步CKPT给服务端，客户端返回ACK，以便服务端了解客户端进度。比如每3秒同步一次CKPT
1. 服务端空闲时，会定期发送CKPT作为心跳，保活链路
1. 如果网络断连，客户端需要重新attach，并传入最近一次position，从该断点


#### position概念



position是逻辑日志（LCR）的全局唯一id，在事务内和事务之间严格单调递增，也不会因为重启或过滤条件，导致position的值发生变化。

commit scn和instance id确保了事务之前提交的顺序，lsn，offset等确保了一个事务内的LCR顺序

#### API接收流程



- API连接数据库后，从Server端批量接收LCR，将LCR的二进制数据转换为java类AbstractLogMinerResult，放到缓存队列
- 用户调用next方法后，从缓存队列pop一个LCR
    - 如果这个LCR是DML/CHUNK，根据当前的元数据，通过调用者实现的Deserializer接口转换为所需的类型
    - 如果这个LCR是XACT，通过调用者实现的Deserializer接口转换为所需的类型
    - 如果这个LCR是DDL，则需要同步更新元数据缓存，通过调用者实现的Deserializer接口转换为所需的类型
    - 如果这个LCR是CKPT，则需要持久化检查点（CKPT不通过next方法返回）


### 4.7 断点续传（    [可用性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    ）

#### 网络断连

服务端和客户端网络断连后，客户端需要重新走JDBC建立连接，同时传入最后一次成功接收LCR的position。

由于服务端的内存数据都在，且客户端需要LCR一定没有淘汰，所以可以从断点position处继续发送LCR。

#### 数据库重启

数据库重启后，Logminer Server会关闭，内存数据会丢失。此时断点续传流程如下：

1. 客户端重新建立JDBC连接，并且传入最后一次成功接收的LCR position
1. 服务端接收到续传消息后，先启动Logminer Server，然后加载checkpoint和元数据
1. **从checkpoint点开始解析redo**  ，直到客户端传入断点position
1. 从断点position处继续发送LCR


#### 数据库故障切换

当Logminer所在的数据库实例宕机后，客户端可以选择另一个数据库实例启动Logminer Server

由于checkpoint，元数据，溢出事务都持久化在系统表里，主备集群里所有实例都可访问，所以断点续传流程  **和数据库重启类似**  ，只需要  **更换IP**  即可

#### 客户端宕机

客户端宕机重启后，客户端未提交的事务都会回滚，此时客户端要从目标数据库上获取最后一次提交成功的事务position，然后传递给服务端

某些实现下，客户端不能获取精确的断点，需要从较早的断点发送，此时会有重复的LCR，需要客户端做可重入处理

#### Checkpoint

checkpoint包含以下日志点：

1. 最老事务开始点：只要从最老活跃事务的开始scn开始解析日志，一定不会漏掉任何未提交的事务。如果有事务长时间不提交，最老事务可能在很早的归档里，扫描性能差。
1. 重启恢复点：这个点之前未提交的事务LCR已经持久化，从这点开始也不会漏掉任何未提交的事务。
1. 客户端已提交点：这个点之前的事务，客户端已经提交，可以清理对应的归档。Checkpoint对应的  **活跃事务，指的是客户端已提交点对应的活跃事务，而不是日志解析中，还没遇到commit的事务**  。


checkpoint定期执行，由参数控制。

#### 重启恢复点的更新

1. 定期扫描一遍客户端未提交的事务，计算每个事务的重启恢复点
1. 如果这个事务没有溢出到磁盘，则事务开始点就是这个事务的重启恢复点
1. 如果这个事务部分数据溢出到磁盘，则未持久化的第一个DML的点就是这个事务的重启恢复点
1. 选择所有事务中，重启恢复点最小的，作为checkpoint的重启恢复点


  


### 4.8 特性可维可测设计

1. 动态视图：
1.     - V$LOGMINER_SERVER：  显示所有Logminer Server的状态，包括运行状态，启动时间，当前进度，checkpoint
    - V$LOGMINER_STAT：显示所有Logminer Sever的统计信息，包括send大小，解析大小，溢出事务大小等

1. 系统视图    

1.     - ALL_  LOGMINER  _EVENTS：显示  Logminer Server的事件，包括启动，关闭，修改过滤条件等
    - ALL_LOGMINER_PARAMETERS：逻辑日志接卸相关参数
    - ALL_LOGMINER_TABLES：显示所有需要解析的表名，由用户设置



### 4.9 特性安全设计

1. 网络连接认证：利用JDBC的能力做连接认证
1. 加密传输：利用JDBC的能力做SSL加密
1. 权限：增加一个逻辑日志解析的role，只有赋予该角色的用户，才可以通过API连接和执行高级包
1. 加密表空间的溢出事务：加密表空间的事务溢出时，需要加密后再插入系统表


### 4.10 特性周边配合

### 兼容性

1. 系统表兼容性：增加了若干系统表，需要加升级脚本
1. 协议兼容性：高版本YashanDB兼容低版本API，在连接时确认两者版本号，后续  **消息协议以低版本为主**
1. 大小端：YashanDB和API客户端支持在大小端不同的机器上


## 5.工作量评估

|服务端|模块|工作量|责任人|  
|
|---|---|---|---|---|
|  
    
    
  Logminer Server|日志挖掘并行化|1人周|马志宏|8人周，1个SR，分两个AR开发|
||解析内存管理|0.5人周|马程飞||
||DDL附加信息与元数据管理|1.5人周|马程飞||
||事务重排组装|1人周|马程飞||
||checkpoint和持久化|1人周|马志宏||
||交互接口（高级包，视图）|1人周|马程飞||
||服务端网络协议|1人周|马志宏||
||联调，自测|1人周|马程飞||
|  
|  
|  
|  
|  
|
|客户端API|客户端网络协议|1人周|梁嘉成|7人周，1个SR|
||元数据管理 |1人周|毛华杰||
||数据类型转换|2人周|梁嘉成、毛华杰||
||测试框架，联调，自测|3人周|梁嘉成、毛华杰||


  


##   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1. **大事务延迟优化**  ：大事务在提交后发送，客户端应用会有较大延迟，可以考虑大事务提前发送，客户端实时应用
1. **透明故障转移**  ：主备故障切换后，API内部自动故障转移到新主库，客户端应用不感知
1. **集群**  ：集群支持CDC API有两种方案：
1.     - 在一个实例上，启动多个日志挖掘线程，分别对应不同的实例redo，然后在事务组装的时候进行重排序，按commit scn顺序输出
    - 每个实例都启动一个日志挖掘线程，解析当前实例的LCR，然后发送到一个实例上，进行事务重排序，按commit scn顺序输出

1. **分布式**  ：每个DN上启动Logminer，将解析到的提交事务，发送汇总到一个节点上，进行事务重排序


  


## Attachments:

[image2023-3-31_17-9-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZTlhIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.D0zBkAmOyMBUM1BE6i28uM0HYf-jBOmBOI90nh6xWrY)

 (image/png)    


[image2023-3-31_17-11-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDBhIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.j9qP-X8HLZ94cV0uUwTvL35dh02Vq7Y_N58eytSX-vI)

 (image/png)    


[image2024-3-21_17-44-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZTliIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.-2mLwAEdQu3DbBfPFbLuKhurDkQpV35zUHmRQEJRtXA)

 (image/png)    


[image2024-3-13_8-38-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZTljIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.S6LKe39uWV7IhYzVxhzmY6cNjTYGytaHXgr0QI5HS30)

 (image/png)    


[image2024-3-13_9-34-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDBiIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.y5yCejqzYo2eE1J23gsPz93fgu-6JcVC51d8sbYOObY)

 (image/png)    


[image2024-3-8_14-18-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZTlkIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.SJtJYxfV175bqe840mizRFf6ssG4-6mlhT-tPtU2ztA)

 (image/png)    


[image2024-3-21_11-45-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDBjIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.xUh3wzvIWCn9hhQgp2wtU54leI7oOwokLnUwm3Rf2qs)

 (image/png)    


[image2024-3-21_11-38-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZTllIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.Qa6a_0WZNoUyp36Y_uZZAdonwLwDZWzPrkS-g8QZKX8)

 (image/png)    


[image2024-3-21_11-25-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZTlmIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.RAiNdgBz-OpA9BYnd3fCVvKHCyGGRsvzFytFcTg6hT4)

 (image/png)    


[image2024-3-21_11-25-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDBkIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.TxkuxRu5bGTKpNUuHJa7F6N1QjIc_9LdmEfOKs0uI78)

 (image/png)    


[image2024-3-20_17-44-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDBlIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.bNCm2bZ_zvN1synqXMBGy03whLPdPh5GWTo7tIc8m1M)

 (image/png)    


[image2024-3-20_17-42-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDBmIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.PtALMh6KhatY2FBIbTXvGWQ4yx1vdaxwkbFxPsW6fJc)

 (image/png)    


[image2024-3-20_17-26-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDEwIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.8EKI1JiZyzmMLyHu956tbuMSM4ZOp5J_o3ijrlw2gZE)

 (image/png)    


[CKPT.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDExIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.QcvVv_U_AQUbls9ijvRgn3lqsj5Gl-B-WnqCNh2kAWg)

 (image/png)    


[CKPT.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZWEwIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.-mDBYi2fB6mRCzOpuSaQE_NplhM2SUZ-QAADvUiOkmw)

 (image/png)    


[image2024-3-23_10-0-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDY4OTcwYzJhZjRmNTIwZWExIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.uwgCFEXwrb-JSe7hWA4iTLHA031PImOoVwRoCZtlYmA)

 (image/png)    


[image2024-3-23_10-1-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDZhMWFkOWEzMzExZGM4ZDEyIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.wVT7BEOUNEr_VnLUGL_Of7fpwssead0V8JqVB3pRnzI)

 (image/png)    


[image2024-3-23_10-1-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDc4OTcwYzJhZjRmNTIwZWEyIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.6HbF9gXIUoap2NG9fc9lvD_ZIvUqbmFj2zRCep6iCZg)

 (image/png)    


[image2024-3-23_10-2-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDc4OTcwYzJhZjRmNTIwZWEzIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.oUl5M3pWzEqa2tHwPqt9SRgNsLge9y74RMXg2rx1nsQ)

 (image/png)    


[image2024-3-23_10-2-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDdhMWFkOWEzMzExZGM4ZDEzIiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.HrVVTlsk7OUVmtN1tBQQCfhO6aHO_HIwDg8vDd9DT6I)

 (image/png)    


[image2024-3-23_10-2-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDdhMWFkOWEzMzExZGM4ZDE0IiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.LoqMjW8UPptgO2FQ0ogX7GvRSdYSqr_odycVE_dLQHQ)

 (image/png)    


[image2024-3-23_10-3-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDc4OTcwYzJhZjRmNTIwZWE0IiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.BkMY56hIgBK-3IufsQoyzLbD2entdfdHtLUsz6X5w6E)

 (image/png)    


[image2024-3-29_17-8-50.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDdhMWFkOWEzMzExZGM4ZDE1IiwicmVmX2lkIjoiNjczOTZjZDU1OTNmOTljOWZmMjM3MzkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzODUwLCJleHAiOjE3ODIzOTAyNTB9.VmhsUvYs-FWmHSamlzwIk2CLKrBgR1ToPneV1pAHx8c)

 (image/png)    


## Comments:

|  [](null)  ,未来规划：自定义过滤条件,Posted by mazhihong at 四月 03, 2024 11:27|
|---|
|  [](null)  ,会议纪要 2024-4-3：,1. 需要考虑适配资源管理
1. 确定性能目标，客户端吞吐50M/s（DML的数据大小），相同业务模型超oracle 30%
1. 未来规划考虑自定义过滤条件
1. 给第三方厂商发API接口方案进行确认
,遗留问题：方案命名,Oracle这套CDC API方案叫XStream，崖山如何起名？,**Yastream**   = logminer service + client java api， CDC =   **Yastream**   + flinkCDC or YDS,Posted by mazhihong at 四月 03, 2024 12:04|
|  [](null)  ,资源过滤：,![](https://pingcode.yasdb.com/atlas/files/public/67396cd78970c2af4f520ea6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFJQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM4NTAsImV4cCI6MTc4MjMxNDY1MH0.glMfM-bGMU7ESOe4Jos8-9ZqLWDJ2i-RNjLLVJzV8L0),Posted by mazhihong at 四月 10, 2024 10:01|
