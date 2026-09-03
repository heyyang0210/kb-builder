Created by 黄文早, last modified on 十月 30, 2024

  


  [https://pingcode.yasdb.com/pjm/items/67064b9ee489dd0868f2f060](https://pingcode.yasdb.com/pjm/items/67064b9ee489dd0868f2f060)    ?    
  #YDBRD-33621 LSC表冷数据编码不因内存不足随意退化

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#1-%E6%80%BB%E8%BF%B0)  

成熟模块的特性，概要设计和详细设计合一，必须说明本设计方案的需求来源，需求分析，功能概要描述。  **此类型设计文档要给出IR到SR拆分的依据。**

关键特性的SR设计，总述可以链接IR的概要设计文档，此处开始主要讲对应SR特性的需求范围。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

性能测试场景发现如下问题：存在冷数据使用了字典编码，并且字典的基数很小，但是由于内存不足，导致有些列的内存没有用上字典编码，从而导致查询性能差 

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

##### 问题原因

1. 内存使用策略上，我们已经将字典内存使用预先级设置为最高优先级，但是cos slice writer 创建时，未针对字典编码内存预留内存。导致创建字典失败。
1. 创建字典成功后，如果出现字典内存无法分配成功，字典也会回退


  


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无。

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#2-%E6%8E%A5%E5%8F%A3)  

**无对外接口（可能有隐藏配置参数）**

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从SR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**     规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

#### 设计思路

当前字典已经是最高优先级的内存，如果出现字典回退，原因为整个writer 内存不足。因此需要增加writer 内存。但是在导入场景下，如果writer 数量少，可能会导致后台写入性能不足前台导入，从而导致导入性能下降。以此，需要按场景分析，一种是导入的场景，一种是转换和compact 场景。

#### 导入场景

可以为字典预分配一定内存配额，这些配额算在writer 的最小配额中，但是内存配额是有限的，不能太多。

##### 方案 ：通过限制每一列最多distinct 数量来限制字典内存。

具体实现为字典预估内存时，根据定义的最大值数量（暂定128）计算出需要的内存大小，并且预占该部分内存。

该方案的好处是，可以比较好地限制字典编码列的内存。保证唯一值较少时，也可以生成字典。劣势为：在内存充足时，需要重新计算字典hash，但是由于值比较少。

并且需要限制writer 最小内存，防止内存不足 控制满足可以   _SCOL_DELTASLICE_COUNT* writer_min_mem <    SESSION_BULKLOAD_MAX_MEM_PERCENT*columnar_vm_buffer_size* columnar_vm_pervent

#### 转换场景

转换场景同时的writer 数量是可控的，可以通过内存预占配额时，计算出writer 需要的内存，并预占配额，并且，即使内存不足场景，也不能回退，需要保证字典可以继续读写。

单个writer最小内存最大256M 

#### 自动生成字典

自适应的字典在任何场景都不预占内存，只在内存充足时，进行。

### 详细设计

1. 字典模块修改，支持hash 重排布
1. 字典模块修改，支持字典内存不足时，继续使用
1. coast writer 配置增加，包括字典能否回退，字典预占值数量
1. 字典提供批量写入的接口，整体换入完成写入。




退化规则如下：

|编码方式|场景|探测期退化|使用期退化|
|---|---|---|---|
|指定字典编码|导入||内存不足|
||||最大基数，值来自_SCOL_MAX_DICTIONARY_CARDINALITY，默认300K|
||转换||最大基数，值来自_SCOL_MAX_DICTIONARY_CARDINALITY，默认300K|
|||||
|自适应字典  
(Char超过128不使用字典)|导入|内存不足|内存不足|
|||探测基数128|最大基数，值来自_SCOL_MAX_DICTIONARY_CARDINALITY，默认300K|
|||首页重复率不满足|累计重复率不满足|
|||||
||转换|探测基数2048|最大基数，值来自_SCOL_MAX_DICTIONARY_CARDINALITY，默认300K|
|||首页重复率不满足|累计重复率不满足|




###   [4.2 特性功能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)  

###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1. coast ut 测试字典不会退，hash 重排布能力
1. 转换测试，字典不回退
1. 导入测试，很少distinct 场景字典预展内存。


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=135610619#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Comments:

|  [](null)  ,自适应的字典，在导入场景，自适应128 个值，先探测4K个值之后确定是否使用字典编码。    
  自适应的字典，在转换场景，自适应2048个值，探测8K个值之后确定是否使用字典编码。,自适应字典回退时，将自身的内存优先级降低为中优先级。    
  自适应增加char 类型限制，超过128 不自适应字典,Posted by huangwenzao at 十月 30, 2024 15:27|
|---|


