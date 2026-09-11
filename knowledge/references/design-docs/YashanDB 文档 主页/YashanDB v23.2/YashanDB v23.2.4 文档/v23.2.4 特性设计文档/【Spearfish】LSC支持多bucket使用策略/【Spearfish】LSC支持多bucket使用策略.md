Created by 谢锐, last modified on 七月 15, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview概述)  

嘉实现场POC中一台物理机有12个盘，但是只部署了2个DN，因而涉及到如何充分使用多盘的问题。

当前LSC默认用法是顺序使用，优先写入第一个bucket，写满后再写入第二个。这种用法无法重复发挥多盘性能。

  


  [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf45](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf45)    ?    
  #YASHAN-1081 存储目录支持动态添加目录

  


## 2. 需求分析

  


1，支持多盘使用提升写入查询性能

  
  展开有如下需求：

1，支持给DN节点挂载多个磁盘。

目前OM不具备该功能，需使用脚本来搞定，且目前必须挂载到YASDB_DATA下的路径。

2，导入时支持将数据打散到多个DataBucket

之前临时做了多dataBucket循环使用的策略。

3，并行查询时可以结合Slice位置信息，将并行任务打散到不同的dataBucket上，提升整理的吞吐量。

--- 多bucket不一定是多盘。可能多个bucket在一个盘上。也可能有的bucket io能力更强。dataBucket目前不感知介质。

  


|  
|需求|方案1|方案2|方案3|备注|
|---|---|---|---|---|---|
|1|支持给DN节点挂载多个磁盘|使用脚本，将盘根据dn划分多个目录，分别链接到对应DN YASDB_DATA下。,并增加对应的databucket。|将新增的多盘做raid，形成统一空间。然后再该空间下根据当前DN节点|将不同的盘直接挂给DN节点。或者统一盘后划分虚拟分区挂给DN节点。,问题扩盘不好搞。|databucket不做磁盘规划管理|
|2|多Bucket数据放置策略|支持多种配置策略：,1，顺序使用,2，循环使用,3，优先最小容量 （后续支持）,4，优先最大容量 （后续支持）|  
|  
|  
|
|3|并行查询bucket感知|目前slice bucket信息，生成scanrange时根据bucket信息，将不同bucket交错返回，让同期的并行任务尽量使用多个bucket。例如:,slice(bucket1) slice(bucket2) slice(bucket3) slice(bucket1) slice(bucket2) slice(bucket3)|改造scanRange，支持携带位置信息(bucket)。并行执行时根据位置信息来调度。|  
|明确上层用法：,上层支持两种并行方式，一种是按分区的，一种是按range的，按分区的是将线程绑定到特定分区上，不允许分区跨线程，线程按序消费分区内的所有range，其主要目的是为了减少执行时数据分发。,按range是将所有分区的range拿到之后，组成一个大数组，多线程按序获取range执行。,  
,不论上述哪种方式，将单分区返回的range按照bucket打散都有助于并行任务打散到不同的dataBucket(盘)上。|
|4|  
|  
|  
|  
|  
|
|5|  
|  
|  
|  
|  
|


  


  


##   [3. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features功能特性)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

  


1，支持配置bucket的使用策略。

2，支持并行查询时，通过优化slice扫描顺序来提升查询性能。

  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces接口)  

列出本方案对外提供的接口、配置参数、API等。

  


1，增加配置参数

    DATABUCKET_WRITE_POLICY  

    值：Sequential，Round-Robin

    默认值：Round-Robin

   立即生效：是

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints规格与约束)  

说明本方案对外的功能规格或约束。

  


暂无

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design详细设计)  

方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。

  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#51-architecture架构)  

说明方案的总体架构，优先考虑通过架构图进行描述。给出业务架构和对应的技术架构，可参考资料：    [https://zhuanlan.zhihu.com/p/269201440](https://zhuanlan.zhihu.com/p/269201440)  

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#52-data-structures--flow数据结构与流程)  

设计主要数据结构、工作流程、时序图等。

  


### 5.2.1 写入并行

通过tablespace的bucket使用策略，如round-robin策略，将写入同一个tablespace的bucket错开使用，可提升整体写入能力。

同时打散数据，便于后续多盘并发查询。

  


方案1：使用配置项来指定系统默认的多bucket使用策略。

方案2：支持指定tablespace的bucket policy。 Alter tablespace XX Alter Databucket policy Round-Robin。

  


Sequential策略：按照bucket加入顺序使用，第一个使用完了，使用第二个，以此类推。

Round-Robin：循环使用，本次导入Slice使用第一个，下一次导入Slice使用第二个。

  


  


### 5.2.2 查询并行

每个分区的扫描任务可以看成是ScanRange的数组，对于LSC表，通常一个ScanRange对应于一个Slice。

Slice上有其存储的bucket信息，因而可以在返回ScanRange数组时，根据bucket信息打散数组顺序。

  


这里SQL有二种并行方式：

分区并行：每个线程操作自己对应的分区，在这种模型下Range扫描执行进度不统一，比较难保证任务充分打散。但是通过打散分区内任务，可以增大打散到多盘的概率。

Range并行：每个线程按序从Range数组中拿Range任务，任务可以看成是N个分区各自任务按序拼成的大数组。这样只要保证数组中Range是打散了，就有比较好的效果。

  


Range在分区内打散：

![](https://pingcode.yasdb.com/atlas/files/public/67396dc98970c2af4f521537/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUJBQUVBQUFBQUFBQWdBQUFBQUFRZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE2OTAsImV4cCI6MTc4MjMyMjQ5MH0.8riMkQ954sJaBbN_PYo4c9GCrUuBmuBVBAMYa_KtRy0)

  


Range不打散，极端情况下同一个bucket的range任务是连续的。

![](https://pingcode.yasdb.com/atlas/files/public/67396dc9a1ad9a3311dc93a9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUJBQUVBQUFBQUFBQWdBQUFBQUFRZ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE2OTAsImV4cCI6MTc4MjMyMjQ5MH0.8riMkQ954sJaBbN_PYo4c9GCrUuBmuBVBAMYa_KtRy0)

  


Bucket空间不足的处理：

  


|  
|场景|当前处理方式|改进|
|---|---|---|---|
|1|提前判断bucket剩余空间不足(小于默认值1G)，或>= maxsize|选择其他bucket|  
|
|2|如果判断bucket未满，实际写入报错。,  
|报错，但是下次还会选择该bucket|细分的话有两种情况：,1，bucket的剩余空间不足以完成本次导入。,2，bucket的maxSize超配，实际不足完成导入。,  
,问题的根因在于我们无法提前确认导入的一批数据的实际空间占用。,这里可以考虑一种优化思路：BUCKET_RESERVED_SPACE,1，对于硬限制，只要剩余空间达到该值即不可写入。,2，对于软限制，只要剩余空间达到该值，即优先使用其他bucket，如所有bucket都达到软限制，则使用剩余空间优先策略,  
,配置建议：BUCKET_RESERVED_SPACE约为单次导入DN的最大空间。,  
,  
,  
,  
|
|3|如果当前事务数据写入成功，但修改bucket maxsize发现超了|目前逻辑是单Slice还可以成功，事务内多Slice会失败，只允许一个Slice略超过maxSize。,  
,所以事务还是可能会失败，且下次还可能选择该bucket|允许当前导入完成，将usedSize置为maxSize。后续使用其他bucket。,风险是超额使用，考虑实际业务场景不建议写满，一般OM达到90%使用率可能就告警建议用户扩盘了。|


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#53-compatibility兼容性)  

说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计。

**在涉及对已交付版本的系统表、系统视图、系统包等特性做修改时，要参照版本兼容性要求文档，给出兼容性设计。**

###   [5.4 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#54-dfx设计)  

按特性的种类可选，涉及安全、性能、可靠、可维、可测；

  


1，通过V$LSC_SLICE_STAT查看Slice分布情况。

2，通过V$DATABUCKET查看bucket使用情况。

3，通过OM监控磁盘负载

###   [5.5 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#55-其他)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases自测用例)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

  


1，验证多bucket策略是否生效。

2，验证多bucket下，并行查询是否可以利用上多bucket，性能是否有提升。

2.1 分区并行

2.2 range并行

  


上车情况：

Agile_L2_sa_heap_yasft_arm：大量失败，看起来修改不相关

Agile_L2_sa_tac_yasft_arm：无关

Agile_L2_sa_lsc_yasft_arm：无关，transform任务内存不足，需要分析原因

Agile_L2_dst_lsc_yasft_arm：需刷用例，新增参数DATABUCKET_WRITE_POLICY

Agile_L2_dst_tac_yasft_arm：需刷用例，新增参数DATABUCKET_WRITE_POLICY

Agile_L2_dst_HA_Switch_docker：修改无关

Agile_L2_cluster_backup_arm_2：修改无关

Agile_L2_cluster_yasft_muti_difObj_sa_6_arm：三个用例失败，其中有两个与Agile_L2_sa_heap_yasft_arm类似，修改无关

Agile_L2_cluster_FT_install_arm：看起来像工程问题

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments: