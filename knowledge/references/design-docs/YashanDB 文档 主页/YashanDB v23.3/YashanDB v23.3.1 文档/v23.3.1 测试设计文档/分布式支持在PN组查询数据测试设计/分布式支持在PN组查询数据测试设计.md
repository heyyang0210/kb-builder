Created by 施新华, last modified on 八月 06, 2024

# 1. 概述

存算一体

- 优点：计算贴近存储的设计，可以充分发挥本地I/O的性能，避免大量数据的网络传输。
- 缺点：计算和存储资源捆绑，无法单独扩展计算资源或存储资源，成本较高。


存算分离

- 计算和存储分层解耦，可独立按需扩展；
- 计算节点无状态，可快速启动关闭；
- 存储层可以基于低成本的对象存储；
- 业界技术发展趋势，在云服务上可以充分利用云的基础设施能力（对象存储、弹性计算）


# 2. 需求分析

SR：

  [https://pingcode.yasdb.com/pjm/items/6638439cc36a3d30a86174e5](https://pingcode.yasdb.com/pjm/items/6638439cc36a3d30a86174e5)    ?    
  #YDBRD-26822 分布式支持PN组路由管理

  [https://pingcode.yasdb.com/pjm/items/663843ddc36a3d30a86175d9](https://pingcode.yasdb.com/pjm/items/663843ddc36a3d30a86175d9)    ?    
  #YDBRD-26823 分布式支持生成PN查询计划

  [https://pingcode.yasdb.com/pjm/items/66384446c36a3d30a8617794](https://pingcode.yasdb.com/pjm/items/66384446c36a3d30a8617794)    ?    
  #YDBRD-26824 分布式支持在PN组执行查询

  [https://pingcode.yasdb.com/pjm/items/66384479c36a3d30a86178ca](https://pingcode.yasdb.com/pjm/items/66384479c36a3d30a86178ca)    ?    
  #YDBRD-26825 分布式支持在PN上查询LSC表

参考：

  [YDBRD-26822 分布式支持PN组路由管理概要设计](156113324.html)  

  [YDBRD-26825:存算分离支持pn端查询设计](156128033.html)  

  [基于PN组的查询计划生成方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=130127255)  

  [PN查询生成方案设计](159416533.html)  

  


![](https://conf.yasdb.com/download/attachments/119559628/yashandb_disaggregated_storage_and_compute.drawio.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIzNDUsImV4cCI6MTc4MjM4MzE0NX0.eqhWRZQ7a-zeFIkNmVenSBD8UuALy1yCsWgsdo-BgqY)

分布式存算分离的架构，增加了PN（Process Node）作为查询的计算节点；其中PN是无状态的且地位平等，多个PN节点可以组成PN组。目前只支持PN对S3存储LSC分布表冷数据查询。

在存算分离架构中，按分布策略将chunk均衡的分布到同一个PN组内的所有PN上；  通过_USED_PN_GROUP(支持会话级和系统级)指定PN组，LSC表查询时CN根据路由信息到对应PN上进行查询，PN上元数据从DN获取，本地缓存MetaCache；冷数据通过S3获取，PN本地缓存DiskCache。

## 2.1 功能点分析

![](https://pingcode.yasdb.com/atlas/files/public/67396e80a1ad9a3311dc976f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIzNDUsImV4cCI6MTc4MjM4MzE0NX0.eqhWRZQ7a-zeFIkNmVenSBD8UuALy1yCsWgsdo-BgqY)

### 2.1.1 LSC表查询执行和计划

通过  _USED_PN_GROUP(支持会话级和系统级)指定PN组。

功能：

- 支持生成PN与DN及CN混合执行的查询计划
- 支持对不同PN组产生不同计划
- 支持PN故障及路由发生变化时使plancache失效
- 表数据存储在S3上，优化器才会使用PN组查询


优化器输入：

- PN组可用信息：会话级配置参数PN组ID。
- PN组路由表，包括chunk到PN节点的对应关系
- 原有的DN组路由信息，包括chunk以及DN节点
- 从DN上获取表元数据
- 从PN上获取部分background信息


优化器输出：

- 含元数据的PN SCAN
- PX的端口，添加对PN的表示
- CN路由表


从CN查询，最终得到的整个plan如下：可能是会部分pn执行，部分dn执行，部分cn执行。

本次新增PN MERGE算子。

![](https://pingcode.yasdb.com/atlas/files/public/67396e808970c2af4f5218fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUNBQUFBQUFCQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBRUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNzIzNDUsImV4cCI6MTc4MjM4MzE0NX0.eqhWRZQ7a-zeFIkNmVenSBD8UuALy1yCsWgsdo-BgqY)

plan cache：

采用plan cache缓存计划，但是执行过程PN节点异常，需要重新生成计划，失效旧的缓存plan。

### 2.1.2 路由管理

**路由算法**

在存算分离架构中，为了快速进行数据查询，需要对PN路由进行管理。

分布式下目前数据通过hash算法分布在不同的chunk，chunk通过路由算法分布在不同的PN，结果通过系统表pn_route$记录，动态视图v$pn_route实时显示路由信息。

**数据**   ---hash-→  **chunk**   ---路由算法-→   **PN**

|PN_ROUTE$||||
|:---|---|---|---|
|DS_ID|NOT NULL|BIGINT|数据空间ID|
|CHUNK#|NOT NULL|INTEGER|CHUNK ID|
|GROUP_ID#|NOT NULL|INTEGER|PN组ID|
|PN_NODE#|NOT NULL|BIGINT|PN节点ID|
|VERSION|NOT NULL|BIGINT|版本|


  


按照平衡原则，  chunk_count个cache数据在pn_count个节点的路由满足：

i)  每个PN至少分配 chunks_count/pn_count 个chunk；

ii) 有chunks_count%pn_count个PN会多分配到1个chunk。

每个chunk在PN只存一份，不存副本。

路由方式描述：

**1)**     按照chunk#1 ~ chunk#n的顺序做分布；

**2)**     分配给PN节点中，目前chunk数最少的节点；

**3)**     如果可分配给多个PN节点（即这些PN节点的chunk数相同），则  选择分配给序号最小的PN节点。

**扩缩容**

**1、扩容**

包括扩容1个或多个PN节点的情况，都按照如下方式进行分配：

① 先按照均衡性和少搬迁的原则，确定新扩容的几个PN节点上，应该分布多少个chunk。

   *如果chunk数为M，扩容后的PN数为n，则按照均衡性和少搬迁的原则，新的PN上分布的chunk最多为M/n+1，且至少有一个新的PN上chunk数为M/n。*

② 对扩容出来的多个PN节点，按ID递增顺序，依次分配。即：先分配完了id较小的新PN，再分配id较大的新PN。

③ 按照分配算法，将老PN节点上的部分chunk路由变更为新的PN节点。

     具体分配算法为：a.优先搬迁chunk较多的老PN上的chunk；b.对chunk数相同的老PN，优先搬迁节点ID较小的PN节点上的chunk；c.搬迁某台老PN上的chunk时，按照chunk id递减的顺序进行搬迁。

*注：这里的“搬迁”其实就是路由变更，并不是指搬迁数据。*

Cache数据的惰性加载机制，主要针对扩缩容和PN节点路由变动的场景。以一个具体例子说明惰性加载机制：

假设有8个PN节点PN1 ~ PN8，其上分别分布有chunk1 ~ chunk8，此外，在PN1上还分布有chunk9。因此，涉及到读chunk1、chunk9的查询都会分发到PN1执行。

如果新扩容了一个PN节点，即增加到9个节点PN1 ~ PN9。按照路由算法，应该将chunk9分配到PN9上去。在惰性加载机制里，chunk9并不会从PN1搬迁PN9，实际上，扩容后chunk9可以直接从PN1删除。而在下次查询涉及到对chunk9的读取时，计划下发到PN9节点，PN9发现在本地并没有chunk9，这时会去S3将chunk9读过来，并放入Cache里。

**2、缩容**

包括缩容1个或多个PN节点的情况，都按照如下方式进行分配：

① 按照路由算法，确定余下的PN节点上，应该分配多少个chunk；

② 按照路由算法，将被缩容的原PN上的chunk，分配到余下的PN节点。

③ 优先搬迁到chunk较少的PN上；按照chunk id递减的顺序进行搬迁。

### 2.1.3 PN上元数据获取

在存算分离架构下，PN  属于计算节点，与DN不同的是，PN不感知事务，且不进行存储数据以及缓存元数据，因此PN不感知与执行DDL操作，且无对应的元数据信息。因此PN端要实现查询，需要从DN进行拉取元数据，且需满足数据一致性。

实现PN端查询将引入下面模块：

1. meta format：元数据格式。
1. meta service：实现元数据提取，负责dn端元数据提取模块。
1. meta store：实现元数据抽取，负责pn端查询所需元数据获取方式模块。
1. shareDcManager：管理pn端对象dictEntry模块。
1. bucket pool：pn端缓存bucket模块。
1. meta agent：pn与dn端交互模块。
1. slsc模块(share lsc)：实现pn端查询lsc表数据，主要负责实现lsc表pn端查询功能模块。


元数据由于需要通信，目前每次只发送小于4m的大小，一个完整的元数据可能通过多次发送，因此元数据在设计上支持切割多次发送。并且为保证元数据的一致性，每次发起请求时都会将查询对应的dc版本发送到dn，保证多次发送时获取的元数据版本一致性。

## 2.2 应用场景

对计算要求高，能快速进行计算节点扩缩容。

## 2.3 规格约束

规格：

- 最大支持32个PN组；
- 每个PN组最大支持64个PN节点


约束：

- 在PN节点组只支持执行查询，不支持对DML和DDL等的执行；
- 暂时只支持创建在S3 data bucket上的LSC表查询，不支持复制表；
- 暂不支持LOB/JSON类型；
- 暂不支持autotrace；
- 暂不支持资源隔离；
- 在PN上执行查询时不支持主键索引;
- 仅支持分布式，需要部署PN，一次只能指定一个PN组


# 3. 详细测试设计

## 3.1 测试设计方法

采用边界值，等价类和场景方法进行用例设计。

## 3.2 详细测试设计

### 3.2.1 功能测试设计

|测试项|测试场景|测试子项|说明|
|:---|:---|:---|:---|
|SQL    
    
    
    
    
    
    
    
|DDL|不同对象增删改|不涉及PN， 功能不影响；PN本地操作拦截|
||DML|普通增删改|不涉及PN， 功能不影响；PN本地操作拦截|
|||带子查询增删改|不经过PN|
||DCL|grant/revoke|不涉及PN， 功能不影响；PN本地操作拦截|
||DQL,  
,  
,  
,  
,  
,  
,  
|覆盖产品文档中所有数据类型|  
|
|||覆盖一级分区以及二级分区表：包括分布表和复制表|LSC复制表不走PN|
|||带操作符查询|  
|
|||带条件查询|  
|
|||分区剪枝，观察计划|PN上执行到CHUNK|
|||聚合查询|  
|
|||group by/having/order by/limit|  
|
|||内置函数|  
|
|||join覆盖：,1. 分布表和分布表；
1. 分布表和复制表；
1. 冷数据和冷数据；
1. 冷数据表和热数据表；
1. 部分冷数据表和部分热数据表。
|  
|
|||集合查询(union, minus, except, intersect)：,1. 分布表和分布表；
1. 分布表和复制表；
1. 冷数据和冷数据；
1. 冷数据表和热数据表；
1. 部分冷数据表和部分热数据表。
|  
|
|||hint：,  [FULL](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#fullhint)         [INDEX](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#indexhint)         [NO_INDEX](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#noindexhint)         [INDEX_FFS](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#indexffshint)  ,  [PARALLEL](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#parallelhint)  ,  [LEADING](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#leadinghint)  ,  [NO_USE_HASH](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#nousehashhint)         [NO_USE_MERGE](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#nousemergehint)         [NO_USE_NL](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#nousenlhint)         [USE_HASH](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#usehashhint)         [USE_MERGE](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#usemergehint)         [USE_NL](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#usenlhint)  ,  [SELECTIVITY](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#selectivityhint)  ,  [BULKLOAD](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#bulkload)  ,  [MAX_WORKERS_PER_EXEC](https://cod-doc.yasdb.com/yashandb/23.3/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%80%9A%E7%94%A8SQL%E8%AF%AD%E6%B3%95/hint.html#max_workers_per_exec)  |  
|
|||并行查询|  
|
|||子查询多表嵌套覆盖：,1. 分布表和分布表；
1. 分布表和复制表；
1. 冷数据和冷数据；
1. 冷数据表和热数据表；
1. 部分冷数据表和部分热数据表。
|  
|
|||带index查询|不走PN|
|||insert into select 冷数据表|不走PN|
|||create as select 冷数据表|不走PN|
|||AC scan|本次暂不支持，但是建AC后查询不能core|
|||LOB类型表|不走PN|
|||JSON类型表|不走PN|
|||4096列百万分区表|验证PN到DN元数据加载，一次性最大4M|
||并发,  
,  
|alter table add/drop column + select ,alter table modify datatype + select (lsc表不支持,    [ALTER TABLE | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/ALTER%20TABLE.html#modifycolumnclause)    ),truncate/drop table + select,增加/删除bucket + select,alter/删除 tablespace set +  select|  
|
|||insert/update/delete 冷数据 + select ,insert/update/delete 热数据 + select |  
|
|||同一个SQL指定不同PN组并发查询|  
|
|||不同SQL指定同一个PN组并发查询|  
|
||数据存储类型    
    
|全冷数据|  
|
|||部分冷数据，部分热数据|  
|
|||全部热数据|不走PN|
|||_USED_PN_GROUP  指定PN不存在|配置报错|
|||_USED_PN_GROUP  指定PN被删除|查询报错|
|||冷数据非S3存储|不走PN|
||统计信息收集|进行统计信息收集后查询|  
|
||直连PN|查询LSC表|查询报错|
||explain|CN上执行explain|显示cn，dn，pn|
|||PN上执行explain|无法查询LSC表， 不支持|
|||DN上执行explain|显示本地信息|
||autotrace|CN上执行autotrace|显示cn，dn，pn|
|||PN上执行autotrace|无法查询LSC表， 不支持|
|||DN上执行autotrace|显示本地信息|
||审计|查看PN上审计信息|  
|
||视图|查询DV视图|包含PN节点信息|
|||PN本地视图查询，包含：V$视图，DBA视图，USER视图，ALL视图|系统表不支持拦截|
||PLSQL|PN内置高级包查询|部分可查询成功|
||用户管理|不同用户连接PN|目前只支持SYS用户连接|
||DUAL|PN本地dual表查询|查询正常|
|路由管理    
    
    
|路由分布|PN组内节点个数<=chunk个数， 查询pn_routes$中路由对应分布|查看V$PN_ROUTE|
|||PN组内节点个数 > chunk个数， 查询pn_routes$中路由对应分布|查看V$PN_ROUTE，查询报错|
||PN扩容|查询过程，PN组内节点扩容，扩容后PN节点数<= chunk数|观察业务是否影响,查询PN_ROUTE$|
|||查询过程，PN组内节点扩容，扩容后PN节点数> chunk数|观察业务是否影响,查询PN_ROUTE$, V$PN_ROUTE，扩容成功，查询报错|
|||PN组内扩容失败回滚|带背景业务|
|||PN组扩容|查询不指定该PN组，业务不影响|
|||PN组扩容失败回滚|  
|
|||查询过程，PN上搬迁chunk：yasboot dataspace redistribute|不支持|
||PN缩容|查询过程，PN组内节点缩容|查询PN_ROUTE$，V$PN_ROUTE|
|||查询过程，PN组内节点缩容到1个|查询PN_ROUTE$，V$PN_ROUTE|
|||PN组内节点缩容失败回滚|带背景业务|
|||查询过程，PN组缩容|带背景业务|
|||PN组缩容失败回滚|带背景业务|
|||查询过程，删除所有PN组|带背景业务|
||PN节点异常|查询过程，PN节点故障|查询PN_ROUTE$，V$PN_ROUTE,1）查询报错或session cancel,2）不影响ddl和dml，查询中分布式视图报错，再次查询成功|
|||查询过程，PN节点重启|查询PN_ROUTE$，V$PN_ROUTE,1）查询报错或session cancel,2）不影响ddl和dml，查询中分布式视图报错，再次查询成功|
|||PN节点故障，然后查询|查询PN_ROUTE$，V$PN_ROUTE,查询成功,不影响ddl和dml，DV视图查询成功|
|||PN节点重启，然后查询|查询PN_ROUTE$，V$PN_ROUTE,不影响ddl和dml，DV视图查询成功|
|||查询过程，PN节点hang住|查询PN_ROUTE$，V$PN_ROUTE,报错,不影响ddl和dml|
|||PN节点hang住，然后查询|查询PN_ROUTE$，V$PN_ROUTE,查询成功,不影响ddl和dml|
|事务一致性|LSC分布表事务|插入冷数据已提交，查询|  
|
|||插入冷数据未提交，查询|  
|
|||更新冷数据已提交，查询|  
|
|||更新冷数据未提交，查询|  
|
|||删除冷数据未提交，查询|  
|
|||删除冷数据已提交，查询|  
|
|||查询过程，DN主备切换|  
|
|导入|导入冷热数据|yasldr导入冷数据过程查询|  
|
|||yasldr导入热数据过程查询|  
|
|||yasldr导入热数据+数据转换过程查询|  
|
|||insert /*+ bulkload/ 模式插入数据过程查询|  
|
|||insert 插入数据模式过程查询|  
|
|备份恢复    
    
|带PN备份恢复    
    
|yasrman执行备份恢复|执行成功|
|||yasbak执行备份恢复|执行成功|
|||备份前PN故障|不影响备份|
|||备份过程PN故障|不影响备份|
|资源配置|参数配置验证|推荐参数|目前未适配|
|||修改PN上MAX_SESSIONS, MAX_WORKERS, MAX_PARALLEL_WORKERS，SCOL_DATA_BUFFER_SIZE，COLUMNAR_VM_BUFFER_SIZE，COLUMNAR_WORK_AREA_HEAP_SIZE，SHARE_POOL_SIZE，PQ_POOL_SIZE|  
|
|资源管理|PN资源管理|CPU|目前暂无|
|||内存|目前暂无|
|新增参数配置|指定PN参数：  _USED_PN_GROUP|生效方式：session配置，系统配置|成功|
|||指定PN组存在|成功|
|||指定PN组不存在|报错|
|新增系统表|PN_ROUTE$|MN/DN/CN/PN分别查询；,故障，扩缩容PN后再次查询|节点故障时与正常时查询结果一致|
|新增视图|V$PN_ROUTE|MN/DN/CN/PN分别查询；,故障，扩缩容PN后再次查询|节点故障与正常查询不一致，剔除故障节点,可实时更新|
|升级|带PN升级|版本升级正常|  
|
|性能|PN查询性能|TPCH 100G查询|性能不低于现有80%|
|资料|PN资料|暂不涉及|  
|


### 3.2.2 可靠性测试设计

|测试项|测试场景|故障类型|测试子项|备注|
|:---|:---|---|:---|:---|
|可靠性|节点故障|PN节点|查询过程，PN组内部分节点故障|查询报错|
||||查询过程，PN组内全部节点故障|查询报错|
||||查询过程，PN组内部分节点重启|查询报错|
||||查询过程，PN组内部分节点hang住|查询报错|
||||PN组内部分节点故障，查询|查询成功|
||||PN组内部分节点重启，查询|查询成功|
||||PN组内全部节点故障，查询|查询报错|
||||非指定PN组故障|不影响业务|
||||全部热数据，PN组内节点部分节点故障|查询成功|
||||全部热数据，PN组内节点全节点故障|查询报错|
|||DN节点|全部冷数据查询，DN组部分故障|查询报错|
||||全部冷数据查询过程，DN主备切换|查询报错|
||||全部冷数据查询过程，DN组全部故障|查询报错|
||||冷热数据均有查询，DN组部分故障|查询失败|
||||冷热数据均有查询，DN主备倒换|查询失败|
||||冷热数据均有查询，DN全部故障|查询失败|
|||CN节点    
    
|CN故障，PN重启，CN恢复后查询|查询成功|
||||CN故障，PN组内扩容，CN恢复后查询|组内可扩容，PN组目前需要节点正常才能扩容|
||||CN故障，PN组内缩容，CN恢复后查询|组内可扩容，PN组目前需要节点正常才能缩容|
|||MN节点    
    
|MN全部故障，进行冷数据查询|查询成功|
||||MN主备切换过程冷数据查询过程|查询成功|
||||MN无主，部分PN重启后查询|查询成功|
||||MN全部故障，PN故障重启后查询|查询报错|
||||PN(node, group)扩容过程，MN主备切换|成功|
||||PN(node, group)扩容过程，MN主备故障|失败|
||||PN(node, group)缩容过程，MN主备切换|成功|
||||PN(node, group)缩容过程，MN主备切换|失败|
||网络异常|PN<->CN|PN与CN之间丢包，错包，时延|  
|
||||CN1与PN组内部分节点网络异常，CN2与PN通信正常|  
|
|||PN<->DN|PN与DN之间丢包，错包，时延|  
|
||||部分PN与DN之间网络异常，其它PN与DN通信正常|  
|
|||PN<->MN|PN与MN之间丢包，错包，时延|  
|
||||部分PN与MN之间网络异常，其它PN与MN通信正常|  
|
|||CN<->MN|CN与MN网络不通，发起查询|  
|
||||CN与MN网络不通，PN扩缩容|  
|
|||CN<->DN|CN与DN之间网络异常，全冷数据查询|  
|
||S3接口|PN与S3存储之间    
    
|PN到存储S3接口异常|查询已经转冷数据若DN未缓存，报错|
||||PN到存储网络不通|查询已经转冷数据若DN未缓存，报错|
||||PN到存储网络丢包，错包，时延|  
|
||磁盘满|PN  数据存储路径磁盘满|查询过程，PN安装路径磁盘满|观察告警，业务|
||||查询之前，PN安装路径磁盘满|查询正常|
||系统资源不足|PN所在服务器|句柄不足|无core|
||||进程数不足|无core|
||||内存|无core|


  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|是|
|可维护性|否|


# 4. 测试用例

文本用例    


   电子表格

   电子表格

# 5. 测试框架设计

yasft，可靠性，CT/KT 测试框架

# 6. 测试环境说明

|IP|内存|磁盘空间|磁盘类型|CPU|操作系统|
|:---|:---|:---|:---|:---|:---|
|192.168.6.153|20G|200G|SSD|6核|centos7.0|
|192.168.6.155|20G|200G|SSD|6核|centos7.0|


# 7. 工作量评估

工作量：4人周

## Attachments:

[image2024-7-10_18-7-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODBhMWFkOWEzMzExZGM5NzZlIiwicmVmX2lkIjoiNjczOTZlODA1OTNmOTljOWZmMjM4NTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ1LCJleHAiOjE3ODI0NTg3NDV9.npkDRbbilIZSXgdv66k5oSbO4Dl5r6LuNUlwJy1Qdec)

 (image/png)    


[分布式支持在PN组查询_文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODA4OTcwYzJhZjRmNTIxOGZjIiwicmVmX2lkIjoiNjczOTZlODA1OTNmOTljOWZmMjM4NTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ1LCJleHAiOjE3ODI0NTg3NDV9.qVR74qVOw7l1kz34FCuaWkp2dxGdgj4RoUhkqla_T1c)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[分布式支持在PN组查询_可靠性用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODA4OTcwYzJhZjRmNTIxOGZkIiwicmVmX2lkIjoiNjczOTZlODA1OTNmOTljOWZmMjM4NTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzcyMzQ1LCJleHAiOjE3ODI0NTg3NDV9.__P4OOS1lljmX0RtpbX4yXJBYPJI-UGu38bn-Rdal98)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
