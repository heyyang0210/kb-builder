Created by 李思语, last modified on 五月 22, 2024

-   [](#package支持LRU淘汰测试设计-)  
-   [1. 概述](#package支持LRU淘汰测试设计-1.概述)  
-   [2. 需求分析](#package支持LRU淘汰测试设计-2.需求分析)  
    -   [2.1 功能点分析](#package支持LRU淘汰测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#package支持LRU淘汰测试设计-2.2应用场景)  
    -   [2.3 规格约束](#package支持LRU淘汰测试设计-2.3规格约束)  
-   [3. 详细测试设计](#package支持LRU淘汰测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#package支持LRU淘汰测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#package支持LRU淘汰测试设计-3.2详细测试设计)  
        -   [3.2.1 场景测试](#package支持LRU淘汰测试设计-3.2.1场景测试)  
        -   [1.单机场景](#package支持LRU淘汰测试设计-1.单机场景)  
        -   [2.并发场景](#package支持LRU淘汰测试设计-2.并发场景)  
-   [4. 测试用例](#package支持LRU淘汰测试设计-4.测试用例)  
-   [5. 测试框架设计](#package支持LRU淘汰测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#package支持LRU淘汰测试设计-6.测试环境说明)  
-   [7. 工作量评估](#package支持LRU淘汰测试设计-7.工作量评估)  


# 1. 概述

*简要说明本功能/需求的背景，本文档的适用范围*

本文描述PL支持CTE语法测试设计

SR：    [https://pingcode.yasdb.com/pjm/items/6618131cfd997db58ad7a93f](https://pingcode.yasdb.com/pjm/items/6618131cfd997db58ad7a93f)    ?    
  #YDBRD-26091 package支持LRU淘汰

部署形态：单机、集群。

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


两种方式：

1.在pl pool 内存不足时自动触发淘汰机制释放空间。

2.执行alter flush命令手动触发淘汰机制，释放内存。

```
alter system flush shared_pool;
```

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


在pl pool空间不足时，将package进行  lru淘汰  ，释放内存空间。

## 2.3 规格约束

- *需求定义的规格、约束，系统/模块上下文等*
- *内部机制涉及的规格约束*


|1|重编译，旧的不会立刻淘汰，重新编译的新的不一定会使内存占用增大|
|---|---|
|2|ddl对象会直接淘汰，其他场景一般不会直接淘汰，等待lru淘汰|
|3|引用计数没有释放完(即正在被人使用)，是不能进行淘汰|
|4|trigger不参与lru淘汰(本次需求不涉及)|


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

本次测试主要采用场景法进行测试

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


### 3.2.1 场景测试

```
--前置条件<share_pool_size设置为最小值>
alter system set share_pool_size=256M scope=spfile;
alter system set lock_pool_size=64M scope=spfile;

--视图辅助
select pool,name,bytes/1024/1024 from V$SGASTAT where pool='SHARE POOL';
select name,TOTAL_SIZE/1024/1024,USED_SIZE/1024/1024,FREE_SIZE/1024/1024 from v$global_mpool;
```

### 1.单机场景

|  
|场景|预期结果|
|---|---|---|
|1| pl pool 快满，继续创建pkg 成功|master报错YAS-00103 no free block in sql pl pool part 0,支持lru不报错|
|2|10w个package创建执行+反复调用|不会报错pl pool不足|
|3|创建UDP,手动flush,pl pool内存释放监控|pl pool内存被释放|
|4|创建DUF,手动flush,pl pool内存释放监控|pl pool内存被释放|
|5|创建存储过程,手动flush,pl pool内存释放监控|pl pool内存被释放|
|6|pkg lru淘汰后,校验全局变量值|全局变量值不会被初始化|
|7|多次重复重编译，监控pl pool内存|pl pool内存占用增大，但不会报不足|
|8|drop pkg，监控pl pool内存|pl pool内存立即释放|
|9|重新起库，手动释放内存，监控pl pool内存|理论pl pool剩余内存前后一致|


### 2.并发场景

|  
|并发场景(CT)|并发数（测试中可调整）|
|---|---|---|
|1|1w个package创建并发执行|10，20，30|
|2|1w个package重编译并发执行|10|
|3|1w个package有依赖对象对象有效|10|
|4|1w个package有依赖对象对象失效|10|
|5|1w个package嵌套调用执行|10|
|6|1w个package创建->调用->重编译->调用->drop|10|


1.手动释放，内存恢复成起库大小值，系统内置高级包内存不释放。

# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2024-3-22_15-47-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWE4OTcwYzJhZjRmNTIwZjE1IiwicmVmX2lkIjoiNjczOTZjZWE1OTNmOTljOWZmMjM3NGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjI5LCJleHAiOjE3ODIzOTEwMjl9.zrmm6VNg9ONhczEoMtNb7Jo5xIQvnW7XwePC4AKvlOg)

 (image/png)    


[image2024-3-22_15-47-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWFhMWFkOWEzMzExZGM4ZDg2IiwicmVmX2lkIjoiNjczOTZjZWE1OTNmOTljOWZmMjM3NGYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0NjI5LCJleHAiOjE3ODIzOTEwMjl9.hZmuN3NQTo88oa0tq1m5Lq3mvixIZaIlzGM7zksYYlM)

 (image/png)    


## Comments:

|  [](null)  ,会议纪要：,1.系统内置高级包内存不参与lru淘汰，手动flush释放内存，内存恢复成起库大小值。,2.创建空壳pkg，占用内存大小是否合理。,3.测试过程需再调整pkg创建数量及并发数。,Posted by lisiyu at 五月 14, 2024 16:31|
|---|
