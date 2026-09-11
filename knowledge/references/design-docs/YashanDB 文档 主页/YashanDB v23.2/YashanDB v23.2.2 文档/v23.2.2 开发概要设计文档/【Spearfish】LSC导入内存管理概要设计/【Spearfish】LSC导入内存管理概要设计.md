Created by 谢锐, last modified on 四月 19, 2024

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#1-总述)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#11-需求来源)  

在深智城环境中内存资源非常少(测试环境每DN配置COLUMNAR VM BUFFER 1.2G)，LSC表导入数据特别容易出现内存不足的场景。

故而提出如下需求：

  [YDBRD-29806](https://jira.yasdb.com/browse/YDBRD-29806?src=confmacro)    -  导数任务内存配置优化  设计中

  [YDBRD-29808](https://jira.yasdb.com/browse/YDBRD-29808?src=confmacro)    -  导数任务的内存占用与分区数解耦  待内部评审

  [YDBRD-29807](https://jira.yasdb.com/browse/YDBRD-29807?src=confmacro)    -  导数任务支持调度排队  待内部评审

  


其核心诉求有：

1，需要给出一个导入数据不失败下的最小内存配置。

2，需要给出一个导入数据内存推荐配置。

3，上述配置的计算方式尽可能的简单，不与表的行大小，列数，列类型，分区数等相关。

4，提供视图等观察手段，分析内存使用情况。

  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#12-调研文档)  

**概述**   友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

*可以在这个章节从功能、性能等各维度比对友商方案，以及我们的设计方案。*

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#13-需求分析)  

  


#### 1.3.1 最小内存

最小内存：单个导入任务下导入不失败的最小内存配额。

这里蕴含了如下要求：

1，最小配额是预申请的，申请成功后，导入期间不能因为内存分配失败而导致导入失败。

2，最小配额是可控的。

     可控要求该值不应该跟具体数据相关，不能说同一个表，一批数据可以成功，换了一批就失败了。

     这要求配额计算不能与行长度，列自适应编码方式，压缩等相关。



#### 1.3.2 推荐内存

推荐内存：单个导入任务在性能有保障的情况下的内存需求。

这里潜在的要求：

1，rgd buffer足够大，但是要合理，不能过度放大（比如导入1G数据，需要10G内存）。

2，coast writer数量足够，尽量不成为性能瓶颈或能把IO资源吃满。

3，列应该尽可能使用合适的编码压缩，以避免查询性能下降。

4，兼顾公平因素，在无法继续提升性能的情况下，单任务没必要申请过多内存。

  


这里无法完全杜绝内存换入换出，比如分区超过或列数非常多的情况。

一方面尽量降低换出对性能的影响，另外在配置上给出建议。

  


#### 1.3.3 StarRocks导入内存配置

  


支持限制总体导入内存和单个导入任务的内存。

参考：    [https://docs.starrocks.io/zh/docs/3.0/administration/Memory_management/](https://docs.starrocks.io/zh/docs/3.0/administration/Memory_management/)  

|  
|  
|  
|  
|
|---|---|---|---|
|1|load_process_max_memory_limit_bytes|107374182400|单节点上所有的导入线程占据的内存上限，取 mem_limit * load_process_max_memory_limit_percent / 100 和 load_process_max_memory_limit_bytes 中较小的值。如导入内存到达限制，则会触发刷盘和反压逻辑。|
|2|load_process_max_memory_limit_percent|30|单节点上所有的导入线程占据的内存上限比例，取 mem_limit * load_process_max_memory_limit_percent / 100 和 load_process_max_memory_limit_bytes 中较小的值，导入内存到达限制，会触发刷盘和反压逻辑。|
|3|load_mem_limit|0|各 BE 节点上单个导入任务的内存限制，单位是 Byte。如果设置为     `0`    ，StarRocks 采用     `exec_mem_limit`     作为内存限制。|
|4|  
|  
|  
|


  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#14-数据字典)  

**描述本篇文档中特性的术语集**

|术语1|描述|是|业界资料链接|
|---|---|---|---|
|术语2|描述|无|原创技术，参考技术设计链接|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#15-开源依赖)  

依赖组件描述和开源协议，三方件原理、背景介绍，依赖的原因以及后续演进方案。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#2-接口)  

**列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**   IR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图） （详细设计：配置参数、驱动接口、用户可感知的错误码、告警、日志）

  


### 2.1 配置项

增加单个导入任务的最大使用内存配置项: COLUMNAR_MAX_BULKLOAD_MEM

默认值为0，即取决于COLUMN_VM_BUFFER。如配置有效值，则该值不能小于要求的最小导入内存。

如果当前导入换出严重，应适当提升该值。如果当前导入没有换出，可适当减少该值，提升导入并行度。

### 2.2 错误码

ERR_XXX: 无法申请导入任务需要的最小内存XX。

Action：请增加COLUMNAR_VM_BUFFER内存配置，或一段时间后重试。

#### 2.3 增加视图V$BULKLOAD_TASK

统计BULKLOAD导入任务的开始时间，表，导入分区数，导入记录数，内存消耗，换出字节数等信息。

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**   规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#4-特性)  

**从IR层级架构方案设计的说明，要呼应1.4章节需求描述中，对特性交付的质量属性详细展开。**   针对功能、性能、可用性、可靠性、可维可测等各维度实现时，关键技术点（技术方案、技术难点、技术风险）的展开。

  


目前Bulkload导入涉及的内存结构如下：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cad8970c2af4f520dc0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI1MjcsImV4cCI6MTc4MjMxMzMyN30.354JszNwM__cNWUlz_zo1bewD9sqxH1DGI4oha73A0w)

  


在23.2版本，已经通过配额的方式支持了内存的换入换出。但是仍然遗留了一些问题：

       1，RGD和Coast Writer共享配额，但无法相互淘汰，很容易出现其中一方占用内存过多导致对方无内存可用的情况。

       2，fullBuffer淘汰依赖CoastWriter写入，fullBuffer如正在写入也不能淘汰且不会等待。

       3，Coast Writer淘汰实现效率低，存在同一内存片段频繁换出又换入的问题.

       4，最低配额需要考虑内存对齐分配放大的情况。

  


###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-特性功能点1)    支持RGD和Coast Writer的配额自适应

  


这里的主要矛盾是问题1. 

RGD和Coast Writer内存管理上有一定差异，RGD内存生命周期相对短，写完可以释放，且几乎可完全淘汰。Coast Writer在RGD Slice导入完成前不可整体换出，部分可以淘汰。

  


改进思路：

导入任务的配额被RGD和Coast Writer 2个部分共享，给2个部分划分一个水位线，水位线可保证每个部分的最小内存需求。

1，在刚开始导入时，RGD和Coast Writer各自按自己需求来申请内存，扩展配额。

2，如果配额无法扩展，且配额未达到上限。这时需要从自己部分淘汰内存。

3，如果某个部分的配额用完，另一部分未达到预期的水位线，可借用另一部分配额。

4，如果某个部分申请内存，且配额被对方占用，尝试拿回配额，淘汰对方内存。

5，如果某个部分内存配额已接近水位，则申请内存时，淘汰已方内存。

  


水位线的控制：

1，刚启动时，设置Coast Writer配额占比1/3.

2，随着导入的进行，当fullBuffer堆积到一定数量或fullBuffer总字节数达到一定量时，将Coast Writer内存占比提升到1/2.

3，最后在会话完成导入时，可将其比例提升到最高2/3，加快写入。

上述数值根据经验做一定调整。上述值需保证RGD或Coast Writer的水位线在最小值之上。

  


![](https://pingcode.yasdb.com/atlas/files/public/67396cad8970c2af4f520dc2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDI1MjcsImV4cCI6MTc4MjMxMzMyN30.354JszNwM__cNWUlz_zo1bewD9sqxH1DGI4oha73A0w)

  


###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#41-特性功能点1)    RGD内存管理

表RGD结构：一个表包含多个分区，每个分区可以有1-2个RGD结构，每个RGD内包含多个RGD Buffer。其中一个RGD Buffer用于当前写入，其他Full Buffer可写入Coast。

  


RGD内存管理上主要做如下改进：

|  
|改进点|最小内存|推荐内存|说明|
|---|---|---|---|---|
|1|按会话粒度控制rgd内存总大小|取下列最小值：,1，保证XX分区数下的常驻内存。1M * XX,2,   保证最小一个batch的反序列化，64 * 32000 * 2-》 4M|尽量保证可以缓存导入的所有数据。约等于导入任务在该节点上的总字节数。|导入时，上层分配的内存目前不受配额控制，其分配模块需限制内存在一定范围内|
|2|RGD支持最小内存运行|1，不论是单行还是批量写入，如无法分配内存，则直接写临时文件,2，从临时文件反序列化时，支持按最大64行的batch按列反序列化,3，coast writer支持按列，非rowgroup对齐写入|扩展配额成功的情况下，不必写临时文件|  
|
|3|支持极致的换出|如果淘汰的fullBuffer所在分区没有coast writer，则直接写临时文件。否则等待coast writer写完。,淘汰优先级：优先淘汰没有coast writer的RGD|  
|  
|
|4|支持根据行大小，自适应调整ROW GROUP大小|根据实际情况调小。另外或支持按片段反序列化，内存使用与rowgroup大小解耦。|期望按默认配置|  
|
|  
|  
|  
|  
|  
|


  


###   [4.3 Coast](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#42-特性功能点2)     Writer内存管理

Coast Writer内存消耗主要在：

1，各个层次的Writer，这部分内存较少，没必要换出。

2，zonemap，其包含2个encoder，且内存是可以较低代价换出的。

3，data encoder以及compressor，这部分内存是临时使用，写完释放。

4，字典，这部分内存占用可能较大，且换出成本较高。

  


  


|  
|改进点|最小内存|推荐内存|
|---|---|---|---|
|1|限制coast writer数量|最少保证1个的配额,  
|N = Coast writer的最大配额 / 实际单个CoastWriter所需配额。 即在内存够的情况下尽可能多的使用。|
|2|明确coast writer最小内存配额和扩展一个coast writer的实际配额|最小配额 = 固定内存（按4K列计算，plain编码） + 最小反序列化片段 + 最大压缩片段内存,实际配额 = 固定内存（按实际列计算，plain编码）+ 最小反序列化片段 + 最小压缩片段内存,实际配额 <= 最小配额|  
|
|3|降低coast writer最小使用内存，保证每列在最小内存下可以写入|1，plain encoder完全换出，降低每列最小内存需求。,2，encoder在超过一定长度时，且无法扩展配额时可以直接写临时文件 （降低超大列内存占用）,3，encoder支持按片段反序列化临时文件。,3，compress片段化 （降低超大列内存占用，已优化）,4，在内存不足(需要淘汰才能得到内存)时，自适应编码可直接选择plain。,5，用户指定编码下也可按4处理，在后续compact时再启用指定编码。,6，强行换出时，支持将字典编码退化成plain编码|1，尽量不换出,2，按照最优方式编码|
|4|coast writer换出优化|1，不应该出现频繁换入换出同一个内存片，造成IO过度放大。,2，保证绝大部分内存都可以换出，避免内存分配失败。|  
|
|5|  
|  
|  
|


###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#43-特性性能点1)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#44-特性性能点2)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#45-特性可维可测设计)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#46-特性安全设计)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#47-特性周边配合)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

  


##   [5.](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5未来规划)    需求分解

  


|  
|IR|SR|说明|时间|
|---|---|---|---|---|
|1|导入最小内存优化|导入刷盘优化|1，支持encoder刷盘，避免换入换出大幅影响性能。,包含退化的字典编码刷盘。,2，Dataset刷盘时支持按列序列化、反序列化。与列数解耦。,3，encoder/Dataset按片段反序列化, 与行数解耦。|  
|
|2|  
|支持最小内存运行|1，支持字典编码退化。,2，改进coast writer内存分配，保证固定内存可以满足要求。,3，RGD支持内存不足时写入刷盘。|  
|
|3|IR 导入内存使用优化|内存使用优化|1，增加单任务最大导入内存限制的配置,2，支持RGD和Coast Writer相互淘汰。支持按规则和优先级进行淘汰。支持淘汰算法的自动调整。,3，支持RGD fullBuffer淘汰，以及fullBuffer正在写入时的淘汰等待。,4，支持内存不足时导入任务排队？,  
|  
|
|4|  
|完善导入内存视图|1，方便分析内存使用，淘汰，刷盘情况。定位性能问题|  
|
|5|  
|  
|  
|  
|


  


整理计划如下：

|IR|SR|AR|任务|价值|开发投入预估（人周）|优先级|
|---|---|---|---|---|---|---|
|导入最小内存优化,  
|优化coast writer内存不足刷盘性能|统一导入刷盘实现|RGD和coast writer刷盘底层实现统一，dataset的按列刷盘，考虑对接vm表空间。|必须，其他修改的基础，同时避免之前实现引起的性能问题|4|1|
||||解决以前coast writer对数据的重复刷盘导致性能过低问题。||||
||||各种encoder适配新接口|  
|  
|  
|
||优化单个导入任务最小内存使用|支持RGD在最小配额下运行|支持RGD和coast Writer各自管理配额|必须，否则RGD最小内存与分区数相关|3（总）|1|
||||支持RGD写入数据超过配额时，直接刷盘|需要，除非规格保证一批数据总是可以写入，即需要限制LSC表行大小， 64行 * X < 最小规格|  
|1|
||||RGD支持按列刷盘/读取，实现与表模型(列数)解耦|需要，否则需限定行大小，以及缩小rowgroup等措施|  
|1|
||||RGD支持按列片段刷盘/读取，避免大列内存开销过大|一般，如RGD最小配额明显超过单列一个rowgroup下的内存消耗，则不是必须。 比如256M。另外一种做法是缩小rowgroup，即导入时根据行大小等选择一个更小的rowgroup|  
|1|
||||RGD fullBuffer淘汰机制完善，支持fullBuffer刷盘，以及正在写入时的等待|必须，否则难以保证最小内存配额下运行|  
|1|
|||支持Coast Writer在最小配额下运行|coast writer常驻部分内存支持配额管理，确保不会失败|必须，实现方案上可超额|3|1|
||||支持配额无法申请时，直接选择plain编码等（字典和number等），忽略用户指定编码|需要，否则允许自适应/用户编码选择导致的导入失败|  
|1|
||||支持字典编码在内存不足时，退化成plain编码|必须，否则字典编码可能失败|  
|1|
|导入任务支持排队机制|支持并发导入任务内存不足时的排队机制|分布式下支持导入资源不足时排队|在CN资源管理上对导入任务的管理|需要|？|1|
|||单机下支持导入资源不足时排队|单机下导入配额不足时，做超时等待|一般|  
|2|
|  
|  
|  
|  
|  
|  
|  
|
|导入内存配额管理优化|支持配置单个导入任务的最大内存配额|支持配置单个导入任务的最大内存|  
|需要，可限制极端情况下单个任务内存配额的无序扩张，主要解决分区过多场景下的问题|1|2|
||优化导入配额管理|RGD和Coast Writer配额管理|支持RGD和Coast Writer相互淘汰。支持按规则和优先级进行淘汰。支持淘汰算法的自动调整。|需要，可优化配额使用，适应各种情况。提升内存使用效率|2|2|
||完善导入内存视图|  
|方便分析内存使用，刷盘情况。|需要，方便定位问题，参数调优|1|2|


  


  


## 6    [.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780324#5未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


1，解耦Coast Writer和RGD，提升大量分区下的导入性能。

## Attachments:

## Comments:

|  [](null)  ,2024.4.10 评审，参与人：何金阳，郭藏龙，黄靖东，黄文早，谢锐,讨论意见：,1，分布式下需进行统一资源管理，如果DN预申请最小资源不成功，应该等待。,2，单机下可考虑在DN(DB)等待。,3,  如果淘汰时分区上有coast writer，可考虑支持将部分数据写入coast writer。,4，淘汰刷盘可考虑对接VM,5，未来考虑后台任务与导入同时执行，而不是现在的打断方式。,6，重新排布SR，审视SR解决的问题以及价值，决定投入。,Posted by xierui at 四月 11, 2024 16:50|
|---|
