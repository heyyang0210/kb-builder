Created by 易文亮, last modified on 六月 06, 2024

# 1. 概述

主要解决分区过多极端场景下，单个任务内存配额的无序扩张，导致内存不足的问题

SR链接：    [https://pingcode.yasdb.com/pjm/items/6618e2c6fd997db58ad823bb](https://pingcode.yasdb.com/pjm/items/6618e2c6fd997db58ad823bb)    ?    
  #YDBRD-26162 优化coast writer内存不足刷盘性能

开发设计：    [优化Coast Writer 内存不足刷盘性能](https://conf.yasdb.com/pages/viewpage.action?pageId=152994409#414-rgd-buffer-%E8%B0%83%E6%95%B4)  

# 2. 需求分析

## 2.1 功能点分析

目前coast writer 内存换入换出机制中，换入换出以列为单位，每次需要整列中所有的内存换入/换出。当内存不能满足需要时，总是需要换出、换入大量空间，从而导致写放大严重。

2.1.1内存细分为一下几类：

1. 定长类型，只分配一次内存，按顺序写入buffer，写满之后整体进行压缩/写磁盘（plain encoder 的定长类型buffer）
1. 变长类型，执行过程中按需分配新内存，由分配者管理多个内存片段，每个新分配的内存片段顺序写入（plain encoder 的变长数据buffer）
1. writer 上下文内存，生命周期与slice writer一致
1. 每次在一个slice 写入过程中会多次申请，释放的内存，例如数据encoder，bitmap。
1. 申请后会随机读写的内存，例如字典的hash index，和字典 value buffer，bloom filter 内存


其中除了第4类内存都可以换出到磁盘中，由于整列换出/换入，内存不足时，容易造成写放大严重

2.1.2 内存管理优化：

1）不可换出内存创建slice writer时一次性全部分配，计算公司，1列的encoder result大概1576字节，4096列需要内存约50M；（只要创建slice writer成功，写入部分数据成功，导入中途就不会失败）

2）可换出的内存，优先级划分：

|优先级|说明|示例|
|:---|:---|:---|
|0|顺序写入，并且已经写满的内存，只会最后进行一次读取，不再写入|plain编码，变长类型申请的内存分片|
|1|顺序写入，但是没写满的内存，后续执行会不断写入，写满后整体读取|plain编码，定长类型的内存|
|2|会发生随机读写的内存|字典编码的索引和值|


3）重构内存分配流程：

如果配额充足，直接尝试分配物理内存，配额不足时，尝试拓展配额，拓展配额失败，新申请的内存，淘汰比该内存优先级低的内存，淘汰过程中，不断尝试，申请配额和内存，直到比此次分配分配优先级低的内存全部淘汰。若分配不出，如果该次分配必须申请物理内存，则报错失败，若非必须，则申请物化内存。

4）字典发生换出，编码回退到plain；（考虑内存不足情形下，长字节列指定字典编码回退场景）

5）物化内存管理：每个slice 固定换出到两个文件中，内存按生命周期划分，分为slice 级别生命周期和block 级别生命周期，两个生命周期中的内存分别换出到一个临时文件中。通过引用计数，统计引用该文件的内存，引用计数降为0时，文件truncate，目的是防止内存申请，释放导致文件空洞产生。（swap换入换出不超过实际的2倍）

2.1.3 RGD buffer调整，rowgroup自适应大小，每个rgd buffer不超2G

2.1.3 coast写入调整：

把原来的按block写入，改为一列一列写入，所有列都写入后再生成原数据文件。需考虑不同的layout存储模式。

换入换出观察v$sysstat视图：

|  
|  
|  
|
|---|---|---|
|1|coast writer换入换出|SCOL SWAP IN ALLOC BYTES    
  SCOL SWAP IN READ BYTES    
  SCOL SWAP IN CNT    
  SCOL SWAP OUT CNT    
  SCOL SWAP OUT FREE BYTES    
  SCOL SWAP OUT WRITE BYTES|
|2|rgd buffer换入换出|SCOL BULKLOAD SWAP BYTES    
  SCOL BULKLOAD SWAP TIME    
  SCOL BULKLOAD SWAP OUT CNT    
  SCOL BULKLOAD TIME    
  SCOL BULKLOAD CNT    
  SCOL BULKLOAD COMMIT TIME|


## 2.2 应用场景

全量导入/增量导入：

（1）在内存资源不足情况下，结合大宽表（含变长列、定长列）、分区表进行导入，考虑多表并发，考虑导入后compact,compact后再导入

（2）考虑字段压缩编码、带字典编码等进行全量导入、增量导入

（3）考虑列长度逐列递增的情况

（4）  结合调整配置参数  COLUMNAR_MATERIAL_PERCENT * COLUMNAR_VM_BUFFER_SIZE * _COLUMNAR_MAX_BULKLOAD_MEM_PERCENT、  BULKLOAD_MAX_MEM_PERCENT、  SESSION_BULKLOAD_MAX_MEM_PERCENT  ，进行导入

（5）layout分别设置为silo/slice/column 

观察相关换入换出视图：

select * from sys.v$sysstat where name like '%BULKLOAD%';

## 2.3 规格约束

无

## 2.4 部署模式

单机、分布式

# 3. 详细测试设计

## 3.1 测试设计方法

- 不同参数组合+不同表类型+不同数据量：场景覆盖法


## 3.2 详细测试设计

|序号|优化点|测试场景|预期结果|
|:---|:---|:---|:---|
|1|slice writer优化，不可换出内存创建时一次性分配，可换出内存按优先级分配|在资源充足/  不充足情况下  ， 全量/增量导入， 非分区表，定长/变长字符（lob）， 宽表（100列/200列)， 单并发分别导入100/1000/10000/n条记录|观察v$allocator/v$sysstat视图，资源充足和资源不足时对比，资源不足优化后内存使用和换入换出少，换出不会出现滥用，不超过实需的2倍|
|2|  
|增加并发导入|不会出现导入成功部分数据的情况，要么slice writer创建成功能导入成功，要么创建失败无数据写入|
|3|字典发生换出，编码会回退到plain|在资源不充足情况下， 考虑字符自适应编码满足生成字典条件，增加表的列数，确认资源不足时是否退化为非字典编码|资源不足时，退化为plain，实际占用磁盘更多，yasminer解析确认|
|  
|  
|在资源不充足情况下， 考虑字符自适应编码/指定字典编码，增加表的列数，确认资源不足时是否退化为非字典编码|会退化为非字典|
|4|按列写入|考虑不同的layout，设置不同的layout，验证资源不足下，验证定长/变长字符（lob）导入|观察视图资源使用，导入成功或报错，DB不异常|
|5|rgd buffer调整|针对目标表，计算的最小内存配置后尝试进行导数|能导入成功不报错|
|6|  
|rowgroup自适应确认，配置不同的内存参数，使用100列char/varchar导入，确认生成的slice和rowgroup情况,（增列内存使用会增加，增加行不一定，RGD按rowgoup写盘）|内存不足，导入成功的前提下，资源越小，rowgroup数越多|
|7|  
|rgd buffer不能超过2G验证，构造宽表（char8000多少列8000*300列*894行≈2G）COLUMNAR_VM_BUFFER_SIZE依次设置为1G、2G、4G、8G，尝试导数3000行，确认导入rowgroup数,定长有2G的限制rowgoup自适应不小于64行，变长还是按配置 |导数成功，1G 8个rowgroup，其他4个|
|8|  
|尝试给4096列的char(8000)COLUMNAR_VM_BUFFER_SIZE依次设置为1G、2G、4G、8G导数（8000*4096*65≈2G）|能导数成功|
|  
|  
|尝试给4096列的varchar(8000)COLUMNAR_VM_BUFFER_SIZE依次设置为1G、2G、4G、8G导数（8000*4096*65≈2G）|能导数成功|
|  
|  
|结合参数修改进行导数验证COLUMNAR_MATERIAL_PERCENT /COLUMNAR_VM_BUFFER_SIZE/ _COLUMNAR_MAX_BULKLOAD_MEM_PERCENT/  BULKLOAD_MAX_MEM_PERCENT/  SESSION_BULKLOAD_MAX_MEM_PERCENT|导数成功|
|  
|  
|固定内存和配置，单分区表/非分区表n列varchar/char导入（不断增列），带并发和不带并发|数据全部导入成功或失败，不会有部分成功的情况|
|  
|  
|验证compact发生字典换出，字典回退，自适应和指定字典编码|确认编码，rowgroup不会自适应|
|  
|  
|先导入再合并，合并后在转换，确认换入换出使用|合并的换入换出变少|
|9|并发导入/增量导入验证|  
|导入成功或报错，无内存泄漏|
|10|性能验证|  
|性能不劣化甚至有提升|


# 4. 测试用例

冒烟文本用例：

1、宽表bulkload导入换入换出降低    
  2、变长列300列varchar1000宽表原来导入报内存不足现在需要导入成功，确认内存不足字典会退化，rowgroup不会自适应    
  3、定长列300列varchar1000宽表原来导入报内存不足现在需要导入成功，确认内存不足字典会退化，rowgroup会自适应

文本用例：

# 5. 测试框架设计

使用Guider原有功能，不做特殊设计

# 6. 测试环境说明

部署：单机+分布式

# 7. 工作量评估

工作量：6  *人天*

计划测试完成时间：2024/5/30

## Comments:

|  [](null)  ,会议纪要：,1、指定字典编码导入，发生字典换出，也会发生字典退化,2、定长列生成slice的rowgroup会根据内存自适应，变长不会,3、需要补充验证非分区表4096列极限情况定长/变长导入不会报错场景,4、需确认slice合并的内存换入换出变小，合并生成的rowgroup不会自适应，补充验证合并发生字典换出会退化的情形,参会人：黄文早、雷语璐、易文亮、任艳芬,Posted by yiwenliang at 五月 15, 2024 10:58|
|---|
