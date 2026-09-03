# 1.   **概述**

本文描述YStream内存优化的测试设计

现状：stream pool独立配置，不由share pool统一管理，会导致下面的问题

  [https://pingcode.yasdb.com/pjm/items/66c55cde8f5ee19173500ffd](https://pingcode.yasdb.com/pjm/items/66c55cde8f5ee19173500ffd)  ?  
#YDBRD-31872 【逻辑备机】构造大量溢出事务导致stream pool不足时，逻辑备机core在sparseMemRead——当前版本是记录fatal日志，在v$diag_incident视图中加一个事件，逻辑备机hang住，需要用户调大stream_pool_size，重启逻辑备机，后续需要优化，能自动管理stream pool

# 2.   **需求分析**

IR链接：  [https://pingcode.yasdb.com/ship/ideas/66d57a7f89f961f330105a43?#YASHAN-3261  Ystream优化](https://pingcode.yasdb.com/ship/ideas/66d57a7f89f961f330105a43?)  

#YASHAN-3261  Ystream优化

SR链接：  [https://pingcode.yasdb.com/pjm/items/67074eebe489dd0868f39616?#YDBRD-33792 Ystream内](https://pingcode.yasdb.com/pjm/items/67074eebe489dd0868f39616?)  

#YDBRD-33792 Ystream内存分配优化

开发文档：  [(2563) YStream 内存优化详细设计 | 知识管理 - PingCode (yasdb.com)](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67510f17d2baff0fd559f5eb)  

需求来源：内部需求

部署形态：单机和集群

功能说明：

当StreamPool没有配置时，YStream，logminer内存分配共用sharepool——  logminer暂不支持

当StreamPool用完时，YStream，logminer内存分配共用sharepool——  logminer暂不支持

|属性|场景名称|方案设计|是否需要测试|测试关键点|
|:---|:---|:---|:---|:---|
|功能|share pool 管理 ystream pool|ystream pool 调整为 share pool 的子pool|是|1. ystream pool不足时，是否能从share pool中正常分配内存，是否影响现有ystream的功能和内存规格，原则上不能影响
1. 对已有的share pool内存分配的影响，v$share_pool的表现
1. 无内存泄漏
|
|功能|ystream pool 支持伸缩|alter system set stream_pool_size = xx;,控制 ystream pool 的上限，可以是 百分比 或 size，超出范围则报错,初始化为0，上限默认是share_pool_size的50%|是|1.  测试ystream pool 的上下限边界，当超过上下限时的业务表现，之前超过上限是解析报错，现在应该能触发stream pool的扩展，不会报错
1. ystream pool缩小条件，当小于下限时，解析/启动报错？
1. 之前因为内存不足报错的场景，现在能正常解析
1. 配置参数资料需要更新
|
|功能|share pool 支持在线扩展|为 share pool 扩充 free blocks（仅支持在线扩展）,alter system set share_pool_size=xx;,缩小时，不能比已占用的内存还小，db open报错|是|1. share pool不足时，在线修改share_pool_size后，业务能正常运行
1. 扩展share pool后，dc pool，lock pool，sql pool，stream pool的实际大小也会同步扩大
1. 只能扩大，不能缩小
|
|可维可测|V$SHARE_POOL，日志|增加 ystream pool 数据，debug日志中新增内存变化相关的信息|是|1. 新增的stream pool内存数据正确
1. debug日志简单明确，无错别字
1. V$SHARE_POOL资料需要更新
|


###   [规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141578197#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- share pool size：由于已分配的内存可能被随机占用，因此 share pool size 只能在线扩大，不能在线缩小。可修改配置参数，重启缩小。
- ystream pool size: 指定 ystream pool size 上限，该上限不一定能达到，受制于 share pool 容量、系统实际可用内存。活跃 ystream 服务可能占用 pool 中的 block，只能所有 ystream 服务都停止时缩小 pool size。
- 支持任意时刻扩展 pool size。取值范围 [0, 64T)， 默认值为 50，即50% share pool size。——  启一个server至少400M，下限0只是理论值，不启动ystream server，后期加隐藏参数，不让用户自己配置，当stream pool不足时，只提示share pool不足


# 3.   **测试设计方法**

1. ystream_pool_size的配置采用边界值法
1. 内存优化功能、异常场景等使用场景法和错误推测法设计
1. DFX覆盖


|系统级DFX分类|是否涉及|
|:---|---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|一致性||
|三方测试工具  
(sqltest，sqlancer)||
|安全||
|DFR||
|HA|涉及|
|压力||
|性能|涉及|
|可维护性|涉及|


# 4.   **详细测试设计**

**观测点：**

1. V$SHARE_POOL视图中记录的ystream的内存使用情况是否正确
1. 内存扩大：达到内存上限时，解析是否报错退出；扩展内存后，是否能继续正常解析
1. 内存缩小：存在/不存在started/running状态的ystream server，通过stream_pool_size和share_pool_size缩小stream pool内存是否成功


|序号  
|功能|测试场景|预期|备注|
|---|---|---|---|---|
|1|ystream pool支持伸缩|show parameter stream_pool_size查看默认值|默认值是50，即50% share pool size|# |
|2||配置stream_pool_size=0，连接ystream server解析|报错||
|3||share_pool_size默认256M，配置stream_pool_size=64T，执行大量ddl/dml业务，连接ystream server解析，达到share_pool_size的实际上限,达到上限后，在线扩展share_pool_size的大小，继续解析|小于share_pool_size的实际上限时，解析正常,大于share_pool_size的实际上限时，解析会报错退出,share_pool_size扩展成功后，继续解析正常||
|4||配置stream_pool_size=64.001T|配置报错||
|5||配置stream_pool_size=最小比例（size小于200M，与并行度有关），连接ystream server解析|配置成功，  解析报错||
|6||配置stream_pool_size=100，连接ystream server解析|配置成功，解析成功——  先测试，看要不要改大share pool的默认值|SQL> alter system set DICTIONARY_CACHE_SIZE=100 scope=spfile;,YAS-06014 the value of parameter DICTIONARY_CACHE_SIZE must be between 1 and 99|
|7||配置stream_pool_size=50，连接ystream server解析，达到share_pool_size的实际上限,达到上限后，在线扩展stream_pool_size的大小，继续解析|配置成功，内存达到share_pool_size的50%解析会报错退出，扩展内存后，继续解析成功||
|8||存在started/running状态的ystream server，通过stream_pool_size和share_pool_size缩小stream pool内存|stream_pool_size缩小报错，share_pool_size缩小成功| alter system set share_pool_size=256M scope=spfile;，重启yasdb|
|9||不存在started/running状态的ystream server，通过stream_pool_size和share_pool_size缩小stream pool内存|成功，  重启需要满足内存大于所有pool size的总和||
|10|share pool支持在线扩展|数据库nomount/mount/open状态，分别改大share_pool_size的值，scope=both|成功||
|11||数据库nomount/mount/open状态，改小share_pool_size的值，scope=both/memory|修改报错||
|12||数据库nomount/mount/open状态，改小share_pool_size的值，scope=spfile，重启数据库，检查share_pool_size和stream pool size、lock_Pool_size/SQL_pool_size的值|修改成功，重启后都会缩小,fixed不会变小,可变的会变化||
|13|share pool管理 ystream pool|存在逻辑备机，在主机构造大量溢出事务导致stream pool不足时，逻辑备机hang时，改大share_pool_size的值|修改成功，逻辑备机能正常解析||
|14||ystream解析过程中，kill重连api，内存会释放？|内存不会释放||
|15||ystream解析过程中，调用高级包stop server，内存会释放？执行大量DDL/DML，观察stream pool的内存是否会被share pool的其他子pool抢占|内存不会释放，执行大量DDL/DML，stream pool的内存会被share pool的其他子pool抢占——  待确认是否释放内存，不释放，当选的机制没法儿做||
|16||ystream解析过程中，kill重启yasdb，再次连接ystream server做解析|内存会重新被初始化，再次解析正常||
|||构造ystream server内存不足场景，在物理备机上连接ystream server做解析时，扩大share_pool_size|原本内存不足的场景，能正常解析||
||性能|使用默认的stream_pool_size，测试解析速度和延迟|性能不会下降||
|17|集群|集群3实例下，覆盖以上场景||三个实例都做业务，连接其中一个解析，修改解析节点的pool size|
|18||集群3实例下，当其他实例有running状态的server，本实例上没有running状态的server，缩小本实例的stream pool size|缩小成功||
|19|内存泄漏|使用asan包以上场景执行结束后，shutdown重启yasdb|不会出现内存泄漏||
|20|升级|22.2/23.2/23.3升级到最新版本，在线扩大SHARE_POOL_SIZE|升级前在线扩大报错,升级后在线扩大成功|只要覆盖没有变更前的任意一个版本到最新版本的升级就可以|
|21|资料|V$SHARE_POOL、SHARE_POOL_SIZE、STREAM_POOL_SIZE的资料描述需要变更，概念手册内存管理章节需要新增stream pool的描述|||


# 5.  ** 测试用例设计**

文本用例

# 6.   **测试框架设计**

使用regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|单机部署一主2备,单机部署集群3实例|


8.   **测试工作量评估**    
共计10人天：

1. 研发串讲，测试调研，测试设计+评审——2天
1. 测试执行+用例自动化+用例调试连跑——6天
1. 问题单回归，上车CI分析，资料测试——2天


暂定2025/1/7上车