

# **适用场景：IR关键特性的概要设计文档，用于拆解SR**



*概要设计-YDBRD-35307 DBMS_PARAM支持去除无关参数*

*IR链接：*  [https://pingcode.yasdb.com/pjm/items/67344741e489dd086808df69?](https://pingcode.yasdb.com/pjm/items/67344741e489dd086808df69?)  

#YDBRD-35307 DBMS_PARAM支持去除无关参数

##   [1. 总述](#1-总述)  

说明本设计方案的需求来源，需求分析，功能概要描述。

###   [1.1 需求来源](#11-需求来源)  

需求来源：内部需求；

需求描述：DBMS_PARAM推荐参数时，支持去除无关参数

需求场景：非相关参数默认忽略；

需求范围：单机、分布式和集群



###   [1.2 调研文档](#12-调研文档)  



###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|DBMS_PARAM推荐参数场景下|支持去除无关参数|是|是|  [https://pingcode.yasdb.com/pjm/items/6740536fd6ec4c2fdf76cc3f?](https://pingcode.yasdb.com/pjm/items/6740536fd6ec4c2fdf76cc3f?)  ,#YDBRD-35663 DBMS_PARAM支持去除无关参数|


###   [1.4 数据字典](#14-数据字典)  

无



###   [1.5 开源依赖](#15-开源依赖)  

无

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|
|SQL语法|```
EXEC DBMS_PARAM.APPLY_RECOMMEND();
```|将最近一次的推荐参数写入配置参数文件|是|


##   [3. 规格与约束](#3-规格与约束)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**  规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](#4-特性)  

###   [4.1 无关参数梳理](#41-特性功能点1)  

|参数|场景|参数描述|是否推荐  
|
|---|---|---|---|
|DATA_BUFFER_SIZE|  
|  
|  
|
|VM_BUFFER_SIZE|  
|  
|  
|
|||||
|WORK_AREA_STACK_SIZE|  
|- 默认值：1024K
- 取值范围/格式：[1024K,64M]
- 参数说明：指定会话内执行内存区（栈方式）大小，推荐使用默认值。出于版本兼容性考虑，该参数允许被设置为小于默认值的值，但实际将按照默认值生效。
|不推荐|
|WORK_AREA_POOL_SIZE|  
|- 默认值：16M
- 取值范围/格式：[4M,1T]
- 参数说明：指定全局执行内存区（堆方式）大小，推荐使用默认值。分布式部署中建议设置为128M。
|单机，集群不推荐。分布式推荐，保持原有逻辑|
|WORK_AREA_HEAP_SIZE|  
|- 默认值：512K
- 取值范围/格式：[128K,4M]
- 参数说明：指定会话内执行内存区（堆方式）大小，推荐使用默认值。分布式部署中建议设置为2M。
|单机，集群不推荐。分布式推荐，保持原有逻辑|
|SHARE_POOL_SIZE|  
|- 默认值：256M
- 取值范围/格式：[256M,64T]
- 参数说明：指定共享缓存区使用的内存大小。执行计划缓存区、数据字典缓存区、锁缓存区、游标缓存区和分布式缓存区共享此区域内存，共享缓存区大小减去锁缓存区大小和游标缓存区大小后再按百分比分配执行计划缓存区、数据字典缓存区和分布式缓存区的大小。如果并发业务较多，建议调大此参数。
|  
|
|LARGE_POOL_SIZE|  
|- 默认值：128M
- 取值范围/格式：[8M,1T]
- 参数说明：指定数据库内部大数据块的总大小。如无明显问题，建议使用默认值。
|不推荐|
|MAX_PARALLEL_WORKERS|  
|- 默认值：32
- 取值范围/格式：[1,MIN(MAX_SESSIONS - 64,4096)]
- 参数说明：单机行存和分布式并行的worker池的worker数量，同时会消耗对应额度的会话资源配额，详情请查阅  [MAX_SESSIONS](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0.html#MAX_SESSIONS)  参数。
|  
|
|SCOL_DATA_BUFFER_SIZE|LSC|- 默认值：128M
- 取值范围/格式：[128M,2T]
- 参数说明：指定LSC存储引擎使用的数据缓存区的大小。缓存区容量越大，数据库整体性能越好。容量过小会产生频繁的数据块换入换出，建议数据缓存区配置至少为1G
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|SCOL_DATA_PRELOADERS|LSC|- 默认值：2
- 取值范围/格式：[0,256]
- 参数说明：LSC存储引擎使用的后台预读线程个数。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|COLUMNAR_WORK_AREA_HEAP_SIZE|  
|- 默认值：64M
- 取值范围/格式：[32M,512G]
- 参数说明：指定会话内列存执行内存区大小，推荐使用默认值。
|过期参数，不推荐|
|COLUMNAR_VM_BUFFER_SIZE|  
|- 默认值：80
- 取值范围/格式：[10,90]
- 参数说明：指定列存计算排序、物化、join等算子使用物化内存占COLUMNAR_VM_BUFFER_SIZE的百分比。当列存计算中，排序、物化、join等涉及的数据量较多时，建议调大此参数，加快计算性能。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|COLUMNAR_BULK_SIZE|LSC|- 默认值：1024
- 取值范围/格式：[1,100000]
- 参数说明：指定列存计算每批次记录行数，需要所有节点的配置都一致。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|COMPRESSION|LSC|- 取值范围/格式：UNCOMPRESSED、LZ4、ZSTD
- 参数说明：指定LSC存储引擎的压缩方式。UNCOMPRESSED表示不进行压缩，LZ4表示采用LZ4算法压缩，ZSTD表示采用ZSTD算法压缩。
|不推荐|
|PQ_POOL_SIZE|  
|隐藏参数：,  
|隐藏参数不推荐，TAC，LSC推荐，保持原有逻辑|
|MAX_SESSIONS|  
|  
|  
|
|MAX_WORKERS|  
|- 取值范围/格式：0 和 [8,16368]
- 参数说明：当线程池启用后，该参数表示线程池中最大的线程数，当MAX_WORKERS设置为0时，实际取MAX_WORKERS值为CPU数 * 2，当MAX_WORKERS >=   [MAX_SESSIONS](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0.html#MAX_SESSIONS)  时，线程池关闭。分布式部署中，线程池一直开启，推荐单个MN、DN上的配置 = 各个CN上配置之和。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|TAB_QUEUE_WINDOW_SIZE|LSC|- 默认值：4
- 取值范围/格式：[1,1024]
- 参数说明：指定会话内数据通道的窗口大小。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|BLOOM_FILTER_FACTOR|LSC|- 默认值：0.3
- 取值范围/格式：[0,1]
- 参数说明：指定bloom filter计划选择的阈值，即底层计划选择率小于该值时，会使用bloom filter。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|DEGREE_OF_PARALLEL|LSC|- 默认值：1
- 取值范围/格式：[1,255]
- 参数说明：指定默认的并行度，优先级低于hint，建议不超过CPU核数的一半，否则会导致性能严重劣化。
|HEAP不推荐，TAC，LSC推荐，保持原有逻辑|
|MMS_DATA_LOADERS|HEAP|  
|不推荐|
|CHECKPOINT_INTERVAL|ALL|  
|不推荐|
|CHECKPOINT_TIMEOUT|ALL|  
|不推荐|
|REDOFILE_IO_MODE|ALL|  
|不推荐|
|DATAFILE_IO_MODE|ALL|  
|不推荐|
|COMMIT_LOGGING|ALL|  
|不推荐|
|RECOVERY_PARALLELISM|ALL|备库、重启并行回放参数|暂时保留,后续可以优化为默认值与CPU核数相关|
|||||
|REDO_BUFFER_SIZE|ALL|  
|不推荐|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|测试场景|预期|
|---|---|
|单机HEAP表场景下执行配置推荐参数|将去除无关参数|
|分布式TAC、LSC表场景下执行配置推荐参数|将去除无关参数，保留TAC、LSC表支持的推荐参数|
|||


##   [6.资料设计章节](#6资料设计章节)  

  [https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_PARAM.html](https://cod-doc.yasdb.com/yashandb/23.4/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/PL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E9%AB%98%E7%BA%A7%E5%8C%85/DBMS_PARAM.html)  

用例刷新

![image.png](https://pingcode.yasdb.com/atlas/files/public/674fcbe2a1ad9a3311de3f40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMjQ5NDUsImV4cCI6MTc4MjMzNTc0NX0.4Ts2pTphEaTBUErr9fC30pje4PqsC0AK2JMOh0fVaFI)

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。