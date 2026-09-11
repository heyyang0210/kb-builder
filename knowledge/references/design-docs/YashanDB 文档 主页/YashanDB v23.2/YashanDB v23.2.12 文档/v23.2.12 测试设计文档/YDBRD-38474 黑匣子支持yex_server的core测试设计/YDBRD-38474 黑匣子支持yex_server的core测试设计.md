# 1.概述

SR链接：  [https://pingcode.yasdb.com/pjm/items/67bebcdd6dccc3daa312d753?](https://pingcode.yasdb.com/pjm/items/67bebcdd6dccc3daa312d753?)  #YDBRD-38474 黑匣子支持yex_server的core

业务在使用到yex_server进程相关的场景时出现coredump时，可以生成对应的黑匣子和core文件，从而方便定位问题。

# 2.需求分析

## 2.1功能点分析

### 2.1.1yex_server进程

yex_server沙箱进程是由yasdb进程在特定场景中自发启动的守护进程，YashanDB将相关功能模块独立加载到沙箱进程上，利用进程隔离思想和进程间通信技术，提高相关功能执行安全性。

### 2.1.2使用yex_server进程的场景

- 调用外置UDF
- 使用DBLINK对远端表执行DML操作


### 2.1.3黑匣子

进程出现故障宕机前，收集进程运行堆栈等信息，存储在自动诊断存储库中。详细介绍可参考：  [https://pingcode.yasdb.com/wiki/pages/67396b5a593f99c9ff236146](https://pingcode.yasdb.com/wiki/pages/67396b5a593f99c9ff236146)  

### 2.1.4黑匣子构成

当yex_server进程发生coredump时，会自动在$YASDB_DATA/external/server目录下创建blackbox文件夹，创建以日期_时间命名（yyyymmdd_hhmmss）的文件夹，并在里面生成对应的文件，包括如下：

- trace.log：数据库版本等基本信息，所有线程堆栈，core线程的dump回调函数的输出
- proc.log：操作系统的/proc/[pid]/xxx文件内容
- yex_server.dump：yex_server进程内存的dump文件


### 2.1.5core文件

当yex_server进程发生coredump时，并且机器环境已经配置好core环境，则可以在对应目录下生成core文件，同时使用gdb命令可以解core，堆栈信息符合预期。

## 2.2应用场景

具体见详细测试设计中使用场景。

## 2.3规格约束

无新增约束，  同yex server本身的约束保持一致

部署形态：支持单机(包含单机主备)、集群和分布式。

# 3.详细测试设计

## 3.1测试设计方法

本次测试设计主要采用场景法进行设计。

## 3.2详细测试设计

### 3.2.1场景测试设计

本次需求测试主要使用kill -11 pid命令来触发yex_server进程产生coredump和黑匣子，同时也需要开发配合来测试验证(查看具体的堆栈函数信息)。

|测试点|测试场景|场景描述|预期|
|---|---|---|---|
|,,,,,基础功能验证|,,,黑匣子目录及文件构成|黑匣子所在目录及其目录命名格式|目录格式为$YASDB_DATA/external/server/blackbox/yyyymmdd_hhmmss       |
|||黑匣子文件构成|包含trace.log、proc.log、yex_server.dump文件      |
|||解析黑匣子内容|使用脚本stack_convert.py可以转换黑匣子代码行号查看堆栈内容，包含如下信息：      ,- 数据库版本、错误等信息
- 线程堆栈函数、行号等信息
- 堆栈地址
- 寄存器信息(Register dump)
|
||,core文件|core文件所在目录，操作系统已正确配置core路径(kernel.core_pattern)和core size|在对应目录下生成core文件，文件命名格式为core-yex_server-pid-xxx     |
|||,解析core文件|- 使用gdb命令：gdb yex_server core-yex_server-pid-xxx可以正确解析core文件     
- 可以获取堆栈的调用链，查看堆栈函数、变量和内存地址等信息，     
- 同时和解析出的黑匣子堆栈内容进行对比，查看关键函数信息是否一致    
|
|,,部署形态|单机(单机主备)|单机和单机主备启动yex_server进程后，执行kill -11|单机(主备)对应数据路径下可以生成黑匣子目录；core目录下可以生成core文件    |
||集群|集群各实例启动yex_server进程后，执行kill -11|集群各实例对应数据路径下可以生成黑匣子目录；core目录下可以生成core文件    |
||,分布式|MN节点启动yex_server进程后，执行kill -11|MN节点对应数据路径下可以生成黑匣子目录；core目录下可以生成core文件    |
|||CN节点启动yex_server进程后，执行kill -11|CN节点对应数据路径下可以生成黑匣子目录；core目录下可以生成core文件    |
|||DN主备节点启动yex_server进程后，执行kill -11|DN主备节点对应数据路径下可以生成黑匣子目录；core目录下可以生成core文件    |
|,,,,,,异常场景测试|core文件大小|OS配置的core size过小，分为如下：,1. 0
1. 介于0和core文件大小之间的数值
|1. 无法生成core文件，但可以生成黑匣子    
1. 可以生成core文件，但不完整(无法解析)；可以正常生成黑匣子    
,|
||core文件存储路径|OS未配置core存储路径|无法生成core文件，但可以生成黑匣子    |
|||OS配置了core存储路径，本地未创建该路径||
||文件目录权限不足|当前用户使用OS配置的core文件目录无写入权限|无法生成core文件，但可以生成黑匣子    |
|||黑匣子所属父目录无写入权限|无法生成黑匣子，但可以生成core文件﻿    ：|
||,,磁盘空间|core目录空间不足|可以生成core文件，但不完整(无法解析)；可以正常生成黑匣子    |
|||core目录空间已满|无法生成core文件，但可以生成黑匣子    |
|||黑匣子所在目录空间不足(小于100M)|可以生成黑匣子，dump文件可能不完整；可以正常生成core文件    |
|||黑匣子所在目录空间已满|无法生成黑匣子，但可以生成core文件    |
||黑匣子存储路径|黑匣子所属父目录不存在|无法生成黑匣子，但可以生成core文件    |
|,业务场景|执行并发业务|yex_server进程下开启多个yasql线程执行并发业务|,校验和解析core文件和黑匣子内容，同基础功能；    ,并发业务下是否产生异常大core文件等    |
||执行单个业务|yex_server进程下开启单个yasql线程执行业务||
||业务类型|业务类型包含dblink和外置udf操作||
|,,其他场景测试|多次执行kill -11 pid + 拉起yex_server进程操作||对应生成多个core文件和黑匣子目录文件，不会被覆盖    |
||数据库环境构造同时存在多个yex_server进程，分别执行kill -11操作|||
||kill -11 yex_server不应影响yasdb进程，yex_server产生黑匣子不影响yasdb的黑匣子||    |
||yex_server进程额外的信息，补充黑匣子信息内容||关注yex_server进程的错误码、message信息    |
||黑匣子内容不应包含敏感信息，比如远程数据库的用户名、密码    |||


### 3.2.2  特性是否涉及DFX测试

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
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


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