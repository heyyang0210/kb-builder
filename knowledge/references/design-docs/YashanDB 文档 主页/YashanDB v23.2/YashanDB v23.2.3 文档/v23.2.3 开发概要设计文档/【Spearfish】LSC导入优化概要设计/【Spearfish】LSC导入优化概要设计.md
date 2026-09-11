Created by 谢锐, last modified on 四月 29, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-总述)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-需求来源)  

LSC在23.2版本对DataX导入做了bulkload优化后，在LSC导入上仍然面临如下问题：

1. 在主键去重的场景下，重复率高时性能下降严重
1. 表内并行，由于scol dbm放大了行锁，容易引起非业务原因导致的死锁。
1. CDC导入的支持，CDC要求数据导入能及时查询，最好直接导冷数据。同时还需要支持索引扫描能力加速点查。


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-调研文档)  

**概述**   友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

  


### 1.2.1 StarRocks方案介绍

*starRocks在表内有tablet概念，每个tablet都是一个独立的存储引擎。tablet内做串行化提交。*

*写入过程主要分为2个步骤：*

*1， 准备阶段，先在Memtable中写入数据，在flush之前，对memtable数据进行*  ***Sort、Merge、Split ***  *三步处理，然后生成对应的rowset数据文件。*

*2，提交阶段，查询 Primary Index 找到所有被更新的记录标记为删除，并生成 DelVector ，与新版本 Meta 一起提交到 RocksDB 中。*

  


其Primary Index采用内存hashmap结构，实现快速的数据去重。

上述步骤不论是否有重复数据，性能差异并不大。导入性能与数据冲突率关系不大。

  


此外该方案不存在死锁问题，Tablet内串行化提交。 不同Tablet不会相互等待。

参考：    [https://zhuanlan.zhihu.com/p/566219916](https://zhuanlan.zhihu.com/p/566219916)  

  


### 1.2.2 GaussDB(DWS)方案介绍

待分析，资料未提及批量导入去重如何处理。支持insert on duplicate, merge等语法。

GaussDB(DWS) 在数据更新时，同样存在锁放大问题，更新会获取CU粒度的锁。

  


参考：

  [https://bbs.huaweicloud.com/blogs/255895](https://bbs.huaweicloud.com/blogs/255895)  

  [https://zhuanlan.zhihu.com/p/425547882](https://zhuanlan.zhihu.com/p/425547882)  

  


### 1.2.3 流式导入调研

1，同步工具是否支持表达update？    
  Flink/SeaTunnel支持将update表达为update_before,update_after. 提供全列数据。

在Flink Jdbc实现中，是将update_before转为delete，将update_after转为insert/upsert，有主键使用upsert，否则使用insert。

Mysql等支持有主键情况下将insert转为upsert(insert on dk update) 。    
  Clickhouse/StarRocks connector中将insert,update_after转为upsert，delete,update_before转为delete。

参考：

  [https://nightlies.apache.org/flink/flink-docs-master/zh/docs/connectors/table/jdbc/#%E5%B9%82%E7%AD%89%E5%86%99%E5%85%A5](https://nightlies.apache.org/flink/flink-docs-master/zh/docs/connectors/table/jdbc/#%E5%B9%82%E7%AD%89%E5%86%99%E5%85%A5)      
    [https://blog.csdn.net/weixin_54625990/article/details/130385809](https://blog.csdn.net/weixin_54625990/article/details/130385809)      
    [https://seatunnel.apache.org/blog/2023/02/09/SeaTunnel_Now_Supports_CDC_Writing_by_ClickHouse_Connector.md/](https://seatunnel.apache.org/blog/2023/02/09/SeaTunnel_Now_Supports_CDC_Writing_by_ClickHouse_Connector.md/)      
    
  2, 如果表没有主键或数据库不支持upsert，那么如何执行update？

这取决于数据库的connector如何实现了。一般而言都是将update_before转为delete，将update_after转为insert。    
  但这样性能可能非常低。所以流式导入一般都要求有主键，即便不支持upsert，也可以根据主键来改写update/delete语句。

  


3，如何保证导入一致性？

flink支持exactly-once语义，有两种实现方法，一是用事务接口，另外就是用flink的sequence label。

  [https://docs.starrocks.io/zh/docs/loading/Flink-connector-starrocks/#exactly-once](https://docs.starrocks.io/zh/docs/loading/Flink-connector-starrocks/#exactly-once)      
    [https://flink.apache.org/2018/02/28/an-overview-of-end-to-end-exactly-once-processing-in-apache-flink-with-apache-kafka-too/](https://flink.apache.org/2018/02/28/an-overview-of-end-to-end-exactly-once-processing-in-apache-flink-with-apache-kafka-too/)  

使用事务接口是否一定保证exactly-once？不一定，还跟flush策略有关系。    
    [https://flink-learning.org.cn/article/detail/75f47917806f2ceebd6094c7f57b9842](https://flink-learning.org.cn/article/detail/75f47917806f2ceebd6094c7f57b9842)  

  


4， 幂等性

导入幂等性不是必须的，在exactly-once语义满足的情况下。

但这是有意义的，可以放低对exactly-once的要求，从而提升整体性能。

  


### 1.2.4 AP的DML

目前OLAP场景下，用户业务操作DML应该是比较少的，非高频操作。

这类操作有：update, insert on duplcate update, delete，insert。

但是支持DML是非常有必要的。不论用户测试使用，还是上线业务。

提供DML能力可简化用户使用，但是不推荐非常高频小事务的DML。

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-需求分析)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

  


1, 去重性能慢的问题

  


下图分别是不同冲突率下的perf统计。

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396cd9a1ad9a3311dc8d22/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUJBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBZ0FBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUlBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFCQkFBQUFBQUFJQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM5MDUsImV4cCI6MTc4MjMxNDcwNX0.MptZOLNbaDWtGpN8iOkuxAc7uZivj2jQLHdQwpsUOvQ)

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cd9a1ad9a3311dc8d23/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUJBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBZ0FBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUlBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFCQkFBQUFBQUFJQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM5MDUsImV4cCI6MTc4MjMxNDcwNX0.MptZOLNbaDWtGpN8iOkuxAc7uZivj2jQLHdQwpsUOvQ)

  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396cd9a1ad9a3311dc8d25/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUJBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBZ0FBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUlBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFCQkFBQUFBQUFJQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM5MDUsImV4cCI6MTc4MjMxNDcwNX0.MptZOLNbaDWtGpN8iOkuxAc7uZivj2jQLHdQwpsUOvQ)

性能分析：

|  
|yasldr总时间(s)|CPU 总时间(s)|准备数据|索引插入|去重|  
|
|---|---|---|---|---|---|---|
|冲突为0|50|22|5.3|14.5|0|  
|
|冲突26%|85|64.5|8.0|22|28|其中indexInsert 2.7， indexDelete 3.2，coralLock 7 ，coralDirectDelete 14.8|
|冲突100%|150|140|7.6|15.4|95.6|其中indexInsert 9.8,indexDelete 11, coralLock 9.5, coralDirectDelete 54|


  


结论：从上述分析看，性能主要瓶颈在于coral删除上，删除在swd item上的加锁开销，此外单行delete放大了io，同时undo开销也比较大。

          根据上述统计数据，预期在优化coral加锁和删除逻辑后。100%冲突性能接近当前26%冲突。 即下降到60-70%左右。

  


  


2, 锁冲突问题

锁冲突的原因是SCol Slice的delete bitmap将一定数量的行集中存储导致的。

集中存储是为了降低查询代价，即查询可以批量处理delete bitmap，而不用每行去检查事务。

  


显然继续沿用之前行锁的机制来并行执行DML/导入，要么SCol也支持行锁，否则无法解决死锁问题。

  


  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语1|描述|是|业界资料链接|
|---|---|---|---|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-开源依赖)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-接口)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**   IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

  


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**   规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-特性)  

  


  


为了解决SCol delete bitmap合并存储带来的死锁，以及写放大问题。这里考虑改变SCol的执行方式。

将 fetch->lock->delete→insert 的单行执行模型。改为 fetch →record delete → insert, 然后再提交时顺序化，批量化的执行模型。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cd98970c2af4f520eb4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUJBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNJQUFBQUFBQUFBQUFBZ0FBQUFBQUFFQUVBQUFBQUFBQUFBQUFBQUlBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFCQkFBQUFBQUFJQUFBQUFBQUFBQUlBQUFBQUFBQ0FBQUFBQUFBSUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM5MDUsImV4cCI6MTc4MjMxNDcwNX0.MptZOLNbaDWtGpN8iOkuxAc7uZivj2jQLHdQwpsUOvQ)

  


### 4.0 DataX导入

datax导入去重的2个问题通过如下方式优化：

1，SCol上的删除合并，解决单条删除效率低的问题。

2，顺序加锁，解决并发死锁问题。

  


### 4.1 CDC导入    


CDC导入的操作：

1， upsert/insert

2， delete

在无主键情况下，需要通过TableScan来定位记录，效率较低。

这里upsert需通过insert /* dedup */ 方式来实现。

  


在带主键的情况下，insert或upsert执行流程如下：

1，在主键/唯一索引上执行主键更新操作，如不冲突则插入，否则覆盖并返回冲突rowid.

2,  如冲突，将冲突rowid计入pendingDelete。

3，将新数据追加写入RGD。

4，提交时，将RGD写成Coast格式。

5，加Scol DBM锁，合并重复rowid后，按序批量执行删除操作。同时删除对应的索引。

     确保btree删除在行锁之后。

     执行顺序可以根据SliceId来，保证每个事务加锁顺序一致。这里删除时即便跟其他事务冲突，要么忽略要么整体失败。

  


流式导入删除操作流程如下：

1，如有主键或唯一索引，通过索引扫描。否则通过表扫描拿到rowid。

     这里需要注意的是索引扫描拿到的rowid可能已经发生了删除，需要通过pengingDelete确认。

2，将rowid计入pengdingDelete

3，其他流程同上。

  


Btree 调整汇总：

1，Btree支持以主键更新方式执行去重语义的插入。并将冲突rowid带出。

     这里主要是为了性能优化，否则先插入失败，然后主键更新把最新冲突rowid带出。

2，列表在语句结束时允许不做ankCheckDuplicate，在事务结束时检查。

3，索引扫描得到的记录不一定是可见的，需要回表确定其可见性。

### 4.2 DML操作

DML更新删除

有不同实现方法：

1，保持当前流程，目前实现按扫描序来遍历并完成批量删除。

     DML加锁顺序可能与导入不一致，引起死锁。

2，使用延迟删除机制。问题是如何区分流入导入和DML操作。

     大批量删除执行效率可能较差。

3，根据操作涉及的数据量来使用不同实现方法。大量数据删除走立即删除，否则走延迟删除，

  


### 4.3 MCol

该方案完成后，默认关闭MCol，支持通过命令打开表的MCol。

MCol的使用场景：偏TP业务，即高频小事务，单列更新，点查等场景。

MCol的影响： MCol上仍然是按行执行的，这部分的流程不变。

  


### 4.4 SCol的事务能力

  


1，由于索引插入是实时完成的，且其上有等待机制，因而对写入冲突没影响。

2，延迟删除并不影响可见性，查询时会结合pengdingDelete信息来决定行的可见性。

3，pendingDelete删除的延迟执行，可能导致删除时误判，即其他事务已经对该行执行了删除,。

     这时有两种情况，一是发生了删除，另外是发生了row movement。

     如果是删除则直接忽略(系统未开启row movement情况下)，

     如果row movement，这时已经无法做语句重启，如果带主键可保证导入数据一致性，可直接忽略。 否则回滚事务。

  


行级回滚：从datax和flink导入来说，这个需求并不强烈。可以考虑在需要时支持。即RGD和pendingDelete结构实现回滚能力。

  


### 4.5  多唯一索引    


推迟删除在多索引下的影响与单索引是一致的。即延迟删除引发的冲突误判。

1，通过主键更新方式保证了冲突时新行的索引值都可以写入。老的rowid记入pengdingDelete。

2，由于唯一索引没有及时删除，可能导致某些不冲突的情况被误判为冲突。这里分两种情况：

    - 同事务误判，这个没有关系，多出的待删除行最终执行时会合并。

    - 不同事务误判，这个在最终删除时，有一个事务先把该行删除，另外一个事务回滚。

  


### 4.6 其他改进

大量冲突或删除的情况下，btree删除操作在SCol 事务锁范围内。增加了不同导入任务在事务锁上的冲突时间。

改进：btree支持不加行锁的情况下删除。

好处是可以将索引操作全部提前，是性能最优的模式。但打破了btree目前约束，不确定哪些地方会遇到坑。

  


## 5.需求分解

  


|  
|IR|SR|AR|说明|计划版本|工作量评估|
|---|---|---|---|---|---|---|
|1|LSC表导入性能优化|SCol支持支持延迟合并有序去重|支持pengdingDelete实现延迟有序删除|btree支持主键更新式写入方案依赖,解决并行导入死锁问题，优化去重性能|23.2|8|
|2|  
|  
|  
|  
|  
|  
|
|3|LSC表支持关闭MCol|SCol支持写入|支持insert直接写入RGD|  
|23.3|8|
|4|  
|SCol RGD支持扫描|RGD支持扫描|  
|  
|  
|
|5|  
|  
|pengdingDelete支持扫描|  
|  
|  
|
|6|  
|LSC表支持关闭MCol|  
|需要Scol上的其他修改作为前置条件。|  
|  
|
|7|  
|DML走pengdingDelete|  
|  
|  
|  
|
|8|LSC表支持upsert ：insert /* dedup */ |SCol支持insert /* dedup */ |  
|insert on duplicate update，一方面执行速度慢，另外还影响批量化|尚未提需求|4|
|9|  
|MCol支持insert /* dedup */ |  
|  
|  
|  
|
|10|  
|  
|  
|  
|  
|  
|
|11|LSC表支持IndexScan|LSC表支持IndexScan|  
|流入导入必须，否则性能无法用。,需根据pengdingDelete可见性判断。|尚未提需求|2|
|12|  
|  
|  
|  
|  
|  
|
|13|  
|  
|  
|  
|  
|  
|
|14|  
|  
|  
|  
|  
|  
|


  


  


  


##   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


参考：

1，    [https://clickhouse.com/docs/en/guides/creating-tables#a-brief-intro-to-primary-keys](https://clickhouse.com/docs/en/guides/creating-tables#a-brief-intro-to-primary-keys)  

2，

## Attachments:

[23.2设计图-Page-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDg4OTcwYzJhZjRmNTIwZWFiIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.I_ik9txvX00Qjtmkz1SMyQAlkbTu5_J27jeY5L8f9jw)

 (image/png)    


[23.2设计图-Page-24_1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDg4OTcwYzJhZjRmNTIwZWFjIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.5aQLeVchaLUNqC5Gw7286yyj8ys2VwrrUjpslF5LtYE)

 (image/png)    


[23.2设计图-Page-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDhhMWFkOWEzMzExZGM4ZDFhIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.BJssJygSOUfWwp8niWquLggd50n8e8YywJpUgtG9Yj0)

 (image/png)    


[23.2设计图-Page-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDlhMWFkOWEzMzExZGM4ZDFiIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.cYpeHqSShZKGZsU27fLxMPcr13FGTgbO8s8yNbzAlFA)

 (image/png)    


[23.2设计图-Page-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDlhMWFkOWEzMzExZGM4ZDFjIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.hmlYlt_lK_nZsdwTNuHFh1cH5oeCfSPSPNH2XLultXQ)

 (image/png)    


[23.2设计图-Page-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDk4OTcwYzJhZjRmNTIwZWFkIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.itzjE2J94UrLo96NHqrAJGB8OWxKxKxABv_DvnuDsj0)

 (image/png)    


[23.3设计图-Page-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDk4OTcwYzJhZjRmNTIwZWFlIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.4ATRF46eVycq6Jwf7ENCWIxUNlamdhtvAwzTW2rLCrA)

 (image/png)    


[23.2设计图-Page-8_2.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDlhMWFkOWEzMzExZGM4ZDFkIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.6YmWSeOhD7OILcea-aMVbqkywzX3uI4xw4bv1AOpjro)

 (image/png)    


[23.2设计图-Page-8_1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDlhMWFkOWEzMzExZGM4ZDFlIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.0RDP9qoa2HAdA4fbaSB5Y8YVcDYHQwM6SmJXFMnwv88)

 (image/png)    


[23.3设计图-Page-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDlhMWFkOWEzMzExZGM4ZDFmIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.Dde-2OFg_-uYAiFQRwH3StzcehPOh6ovUyl0nyz_onU)

 (image/png)    


[23.3设计图-Page-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDk4OTcwYzJhZjRmNTIwZWFmIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.vA5NU0Lso_vgaft328YxozuuuvVCWYFAfvH8Xi7UjkE)

 (image/png)    


[23.2设计图-Page-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZDlhMWFkOWEzMzExZGM4ZDIwIiwicmVmX2lkIjoiNjczOTZjZDg3MjgyMDZlZmI5MmYxNzYzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAzOTA1LCJleHAiOjE3ODIzOTAzMDV9.YYUCCXHkU0CxWTMd0-CfxwOKkBX8NR7qSZMrB0USCLk)

 (image/png)    
