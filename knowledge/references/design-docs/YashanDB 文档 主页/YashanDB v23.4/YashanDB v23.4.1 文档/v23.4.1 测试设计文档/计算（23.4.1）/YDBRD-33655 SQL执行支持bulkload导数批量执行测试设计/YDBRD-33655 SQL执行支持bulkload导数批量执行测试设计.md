Created by 施新华, last modified on 十一月 06, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/670721a4e489dd0868f31bca](https://pingcode.yasdb.com/pjm/items/670721a4e489dd0868f31bca)    ?    
         #YDBRD-33655 SQL执行支持bulkload导数批量执行

开发设计：    [SQL执行支持bulkload导数批量执行 设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=171053456)  

交付形态：单机，分布式

# 2. 需求分析

分布式和单机部署模式下，LSC表绑定参数插入采用BATCH模式。

优化‌BatchError模式插入数据异常时处理，可跳过错误数据继续执行，提升性能。

## 2.1 功能点分析

1）增加参数_BATCH_ERROR_PROCESS_SIZE控制接入DB节点对多批次执行的切分粒度，配置越大占用内存越大，一次切分粒度越大，执行效率越高；该参数从WORK_AREA_HEAP_SIZE，SHARE_POOL_SIZE配置分配内存。

- 参数类型：数值
- 默认值： 2 M
- 取值范围/格式：[1 M, 128 M]
- 参数说明： 控制接入DB节点对多批执行的切分粒度，配置得越大，占用的内存越大/一次切分执行的粒度越大，执行效率越高。
- 修改立即生效：是
- 会话级参数：否
- 只读参数：否
- 多节点是否要求一致：否


2）CN上绑定参数批量插入执行优化。

3）DN适配batch mode insert，提升处理效率。

4）插入失败处理:

    CN处理：

先回滚到上一个savepoint

根据dn传回的信息，判断需要skip的batchno。

给对应的分发数据标记上isSkipped = true。

    DN处理：

分布表多rows执行/复制表执行：

不同dn失败的行不可确定，需要同时回滚，再在cn上统一处理。

处理流程示例：

dn1要执行 100条，dn2要执行 120条。 dn1执行到 50条产生了失败，dn2执行到70条产生了失败。

都要返回错误行号和原因给cn，将整批执行回滚掉，并跳过出错的行，重新执行。

如此往复，直到所有行插完。

单row分布表：

处理流程示例：

dn1执行100条，dn2执行120条。dn1执行到50条产生了失败。dn上都继续往下执行。

最终把失败的行号和原因返回给cn，cn继续执行下一批次。

## 2.2 应用场景

LSC表通过批量参数绑定的方式导入性能优化提升。

## 2.3 规格约束

- LSC表  batchError模式插入性能优化。


# 3. 详细测试设计

## 3.1 测试设计方法

_BATCH_ERROR_PROCESS_SIZE参数测试采用有效等价类，无效等价类和边界值进行验证。

其它采用场景法进行验证。

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


|测试项|测试场景|测试子场景|预期|
|---|---|---|---|
|_BATCH_ERROR_PROCESS_SIZE参数  







|参数范围(单机，分布式)    
    
    
|配置范围[1 M, 128 M]，WORK_AREA_HEAP_SIZE/SHARE_POOL_SIZE配置满足各参数需求,  [SHARE_POOL_SIZE相关参数](https://conf.yasdb.com/pages/viewpage.action?pageId=177839292)  |配置成功|
|||配置范围[1 M, 128 M]，WORK_AREA_HEAP_SIZE/SHARE_POOL_SIZE配置不满足各参数需求|配置成功，业务运行报错，提示信息合理|
|||配置参数等于1M， 配置参数等于128M|配置成功|
|||配置参数小于1M， 配置参数大于128M|配置失败|
||参数生效方式(单机，分布式)    
    
    
|alter system set _BATCH_ERROR_PROCESS_SIZE=x scope=both,alter system set _BATCH_ERROR_PROCESS_SIZE=x |立即生效|
|||alter system set _BATCH_ERROR_PROCESS_SIZE=x scope=spfile|重启生效|
|||alter system set _BATCH_ERROR_PROCESS_SIZE=x scope=memory|立即生效|
||参数修改范围(分布式)|alter system set _BATCH_ERROR_PROCESS_SIZE=x  type=cn|配置成功|
|||alter system set _BATCH_ERROR_PROCESS_SIZE=x  type=all|配置成功|
|||alter system set _BATCH_ERROR_PROCESS_SIZE=x  type=mn|配置成功，但是只有CN使用此参数|
|||alter system set _BATCH_ERROR_PROCESS_SIZE=x  type=dn|配置成功，但是只有CN使用此参数|
|||alter system set _BATCH_ERROR_PROCESS_SIZE=x  node=2-*|配置成功|
|性能    
    
    
    
    
    
    
    
    
    
    
|DataX同步性能验证(单机，分布式)    
    
    
    
    
|_BATCH_ERROR_PROCESS_SIZE默认配置(2M)，通过dataX验证LSC表(分布式为分布表)同步性能|提升30%|
|||_BATCH_ERROR_PROCESS_SIZE默认配置(1M)，通过dataX验证LSC表(分布式为分布表)同步性能|性能比1M配置下降|
|||_BATCH_ERROR_PROCESS_SIZE默认配置(64M)，通过dataX验证LSC表(分布式为分布表)同步性能|性能提升|
|||_BATCH_ERROR_PROCESS_SIZE默认配置(128M)，通过dataX验证LSC表(分布式为分布表)同步性能|性能提升|
|||_BATCH_ERROR_PROCESS_SIZE默认配置(2M)，插入数据中带有带有绑定参数和stable函数，例如：systimestamp/sysdate/sys_guid|观察性能|
|||_BATCH_ERROR_PROCESS_SIZE默认配置(2M)，增加分区数(单DN14分区)通过dataX验证LSC表(分布式为分布表)同步性能|性能提升|
|||_BATCH_ERROR_PROCESS_SIZE默认配置(2M)，通过dataX验证LSC复制表同步性能|性能提升|
||yasldr basic导入(单机，分布式)    
    
    
|_BATCH_ERROR_PROCESS_SIZE配置2M，导入LSC表(分布表复制表)|性能提升30%|
|||_BATCH_ERROR_PROCESS_SIZE配置64M，导入LSC表(分布表复制表)|性能提升|
|||_BATCH_ERROR_PROCESS_SIZE配置128M，导入LSC表(分布表复制表)|性能提升|
|||_BATCH_ERROR_PROCESS_SIZE配置2M，导入LSC表(分布表复制表), 分别带  ENABLE_BULK=TRUE和ENABLE_BULK=FALSE|ENABLE_BULK=TRUE性能>ENABLE_BULK=FALSE|
|||_BATCH_ERROR_PROCESS_SIZE配置2M，BATCH_SIZE=65535, 导入LSC表|  
|
|||_BATCH_ERROR_PROCESS_SIZE配置2M，导入单机行表|性能不下降|
||LOB类型数据|_BATCH_ERROR_PROCESS_SIZE配置2M，LOB类型长度为1G，通过绑定参数插入|性能提升|
|||_BATCH_ERROR_PROCESS_SIZE配置128M，LOB类型长度为1G，通过绑定参数插入|性能提升|
||IMP性能验证|默认配置，导入数据性能验证|性能提升|
|失败处理（分布式）    
    
    
    
    
|多行同时插入|insert into table (?,?),(?,?),(?,?);,其中一个DN上数据出现错误（违反约束，类型转换失败，未命中分区）|CN继续执行，跳过错误|
|||多个DN上数据存在错误（违反约束，类型转换失败，未命中分区）|CN继续执行，跳过错误|
||复制表插入|其中某行数据错误（违反约束，类型转换失败，未命中分区）|CN继续执行，跳过错误|
||单行插入|insert into table (?,?);,某行数据错误（违反约束，类型转换失败，未命中分区）|CN继续执行，跳过错误|
|||多行数据出现错误（违反约束，类型转换失败，未命中分区）|CN继续执行，跳过错误|
||插入过程节点异常|其中一个DN组节点异常|数据回滚或继续推送|
|||MN主节点异常|数据回滚或继续推送|
|||CN异常|数据回滚或继续推送|
|资料|产品文档|参数介绍|添加说明|
|||WORK_AREA_HEAP_SIZE/SHARE POOL SIZE 内容补充|增加说明|


|系统级DFX分类|是否涉及|测试点|
|:---|:---|:---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|是|异常回滚后数据一致|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|是|故障后数据一致|
|HA|  
|  
|
|压力|  
|  
|
|性能|是|带绑定参数插入数据性能|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机，分布式|


# 7. 工作量评估

工作量：  *10人天*

计划测试完成时间：