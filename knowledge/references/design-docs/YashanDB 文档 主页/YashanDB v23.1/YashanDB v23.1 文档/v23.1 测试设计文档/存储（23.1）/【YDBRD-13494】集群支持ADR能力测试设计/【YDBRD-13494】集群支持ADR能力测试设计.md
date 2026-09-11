Created by 郑荃, last modified on 一月 25, 2024

# **1. 概述**

故障诊断结构有助于预防、检测、诊断和解决问题。发生严重错误时，将为其分配一个事件编号，并立即捕获该错误的诊断数据并使用此编号进行标记。然后，数据将存储在自动诊断存储库 （ADR）（数据库外部基于文件的存储库）中，以后可以按事件编号检索并对其进行分析。    
  故障诊断结构需要实现的目标是：

- 首次故障诊断
- 问题预防
- 检测到问题后限制损坏和中断
- 减少诊断时间
- 缩短解决问题的时间


# **2. 需求分析**

**开发文档：**    [自动诊断存储库（ADR）](/pages/createpage.action?spaceKey=YAS&title=%E8%87%AA%E5%8A%A8%E8%AF%8A%E6%96%AD%E5%AD%98%E5%82%A8%E5%BA%93%EF%BC%88ADR%EF%BC%89)  

**SR链接：**    [YDBRD-13494](https://jira.yasdb.com/browse/YDBRD-13494?src=confmacro)    **-**  **【23.1】集群支持ADR能力**  **完成**

自动诊断存储库（ADR）需求分为4部分：

1. 数据库故障事件框架
1. 数据库部分故障容错处理
1. 健康检查框架
1. 巡检
1. 支持视图：    
  V$HM_CHECK（检查项视图）    
  V$HM_CHECK_PARAM（检查项参数视图）    
  V$HM_RUN（  所有健康检查相关信息及其状态  ）    
  V$HM_FINDING （  相关检查成果  ）    
  V$DIAG_PROBLEM（问题视图）    
  V$DIAG_INCIDENT（事件视图）


### 数据库故障事件框架

- 新增问题和事件视图：v$  DIAG_PROBLEM  和 v$  DIAG_INCIDENT
- 数据库运行过程中产生故障会记录问题，  相同的故障发生一次或多次，只记录一个问题，可以通过  问题视图：v$PROBLEM_INFO查询
- 事件是问题的单个发生，数据库运行过程中，不同的session可能产生相同的问题，数据库会创建多个事件，可以通过事件视图：v$  DIAG_INCIDENT  查询
- 在一小时内针对同一问题发生 5 个事件后，此问题的后续事件将受到洪水控制
- 在一天内针对同一问题发生 25 个事件后，此问题的后续事件将受到洪水控制
- 当受到洪水控制时记录一条告警日志
- 刷日志时先刷问题日志，再刷事件日志
- ADR路径配置（暂不支持配置），  默认值" ?/diag "
- 事件上限1024，超过1024个后会覆盖


当前支持的抛事件的

  [https://conf.yasdb.com/pages/viewpage.action?pageId=72778704](https://conf.yasdb.com/pages/viewpage.action?pageId=72778704)  

### 数据库部分故障容错处理

实现部分故障的解决手段

|故障|修复方案|备注|
|:---|:---|:---|
|磁盘空间不足(归档)|目前策略：归档线程抛事件，切换redo报错|  
|
|applyAddRedoFile：增加redo|当磁盘空间不足，等待磁盘释放|  
|
|applyCreateDataFile：创建数据文件|当磁盘空间不足，等待磁盘释放|  
|
|applyExtendDatafile：扩展数据文件|当磁盘空间不足，等待磁盘释放|  
|
|redo文件损坏|实现强制启动|已在redo强制重启中覆盖|
|changeNum不连续|已实现概率性修复|  
|


### 健康检查

健康检查目前涉及4个动态视图和2个函数

1、检查方式：

- 自动：数据库定期的运行HM框架对数据库的各个组件进行检查
- 手动：通过存储过程来手动的运行HM架构对指定的组件进行健康检查


# **3. 测试**  **设计方法**   

对于各种事件的测试主要采用场景法和错误分析法

对于洪水控制测试采用等价类划分和边界值

### 事件与问题

以下场景需要覆盖支持抛事件的各种故障类型进行覆盖，支持的故障类型见需求分析

1、问题

|场景|预期结果|
|:---|:---|
|产生未发生过的问题|记录一个问题|
|相同的故障发生一次或多次|只记录一个问题，统计信息会更新成最新的|
|触发一个不会抛事件的故障|不记录问题|


2、事件

1）验证  并发不同session产生同一个问题

2）  事件上限1024，超过1024个后会覆盖

3)验证洪水控制：

1、未产生洪水控制，不会有告警日志，v$  DIAG_INCIDENT  和v$  DIAG_PROBLEM  会正确更新

2、产生洪水控制时，产生告警日志，v$  DIAG_INCIDENT  和v$  DIAG_PROBLEM  不会更新，超过时间后会更新

  


|分类|场景|  
|
|:---|:---|:---|
|每小时--同一问题|5个事件以内|  
|
|  
|5个事件|  
|
|  
|超过5个事件|  
|
|  
|同一个问题事件超过5个后，再产生其它问题的事件|  
|
|  
|同一个问题事件超过5个后，事件超过1个小时候以后再该产生事件|  
|
|每一天--同一问题|25个事件以内|  
|
|  
|25个事件|  
|
|  
|超过25个事件|  
|
|  
|同一个问题事件超过25个后，再产生其它问题的事件|  
|
|  
|同一个问题事件超过5个后，事件超过1天以后再该产生事件|  
|


3、异常场景

写问题和事件日志的过程中，由于数据库异常，重启，可能导致半写坏块问题，针对半写坏块问题，进行构造

  


|场景|预期结果|
|:---|:---|
|问题记录不全，事件未记录|重启后，记录不全的问题会被删除，查询不到|
|问题记录全，事件未记录全|重启后，问题记录，事件丢失|
|问题记录是/非最后一条出现坏块|重启失败，删除后重启成功|
|事件记录是/非最后一条出坏块|重启失败，删除后重启成功|
|事件和问题同时出现坏块|重启失败，删除后重启成功|


  


4、视图验证，针对视图的每个字段进行构造，观察取值是否符合预期

v$  DIAG_PROBLEM

v$  DIAG_INCIDENT

### 故障容错处理

针对新增的故障处理，构造故障后，查看容错机制是否能够正常生效，故障恢复后，环境是否正常，相关业务恢复正常。

需要验证HA和单机环境

  


### 健康检查

支持的健康检查项

- 数据库整体性检查
- 数据页面完整性检查
- 单个数据文件的检查
- 日志完成性检查
- 单个日志文件的检查
- 单个归档日志的检查


对行存和列存的data、redo、undo、btree的页面构造故障。

1、  DBMS_HM.RUN_CHECK测试

- DBMS_HM.RUN_CHECK的测试结合V$HM_CHECK和V$HM_CHECK_PARAM进行测试，V$HM_CHECK和V$HM_CHECK_PARAM是可以进行健康检查项的一些信息，只需要验证视图里面显示的内容是否正确即可


|输入条件|有效等价类|无效等价类|备注|
|:---|:---:|:---:|:---:|
|参数个数|  
|  
|  
|
|  
|3|0、1、2、4|后面2个参数可以为null，但是必须有|
|check_name|  
|  
|  
|
|  
|在  V$HM_CHECK存在|在  V$HM_CHECK不存在|  
|
|  
|直接跟字符串，或者to_char()函数|长度超过  VARCHAR  (64  )|  
|
|  
|  
|为null|  
|
|run_name|  
|  
|  
|
|  
|1-32个字节|长度超过  32个字节|  
|
|  
|null|带空格，特殊字符，关键字|  
|
|  
|直接跟字符串，或者to_char()函数|已经起过的名字|  
|
|input_params|  
|  
|  
|
|  
|在V$HM_CHECK_PARAM存在，且类型正确|不在  V$HM_CHECK_PARAM|  
|
|  
|参数所在的位置没有故障|数据类型和参数不符合|  
|
|  
|参数所在的位置存在故障|参数之间非；隔开|  
|
|  
|null|参数个数跟实际不符合|  
|
|  
|直接跟字符串，或者to_char()函数|参数所在的位置超过当前环境所在的范围|针对datafile，检查构造不存在的datafile，blockid超过当前datafile的block范围|


- 健康检查的上限  1000000  ，超过后覆盖旧的健康检查
- DB_OFFLINE：在数据库的NOMOUNT阶段可以执行健康检查
- DB_ONLINE：在数据库mount\open之后可以进行健康检查


|场景|预期|备注|
|:---|:---|:---|
|健康检查次数达到上限后，继续做健康检查|健康检查可以成功，旧的健康检查被覆盖，查询不到|上限100W|
|健康检查达到上限后，旧的检查被覆盖后，使用被覆盖的健康检查  run_name|备覆盖的  run_name使用不会报错|  
|
|DB_OFFLINE类型的检查项，mount、nomount、open 阶段做健康检查|可以成功|  
|
|DB_ONLINE类型的检查项，nomount、nomount阶段不能做健康检查|报错|  
|
|DB_ONLINE类型的检查项，open状态可以做健康检查|可以成功|  
|
|没有发生故障时做健康检查|  
|  
|
|单个故障、多个故障同时存在时做健康检查|  
|当前只支持数据块完整性检查检查|
|故障恢复后做健康检查|  
|  
|


  
  2、DBMS_HM.GET_RUN_REPORT测试

- DBMS_HM.GET_RUN_REPORT  的测试结合V$HM_RUN和V$HM_FINDING进行测试，V$HM_RUN和V$HM_FINDING是健康检查的结果，健康检查的报告是从视图中获取，对比健康检查报告和视图中的信息是否对应， 描述是否正确


|输入条件|有效等价类|无效等价类|备注|
|:---|:---:|:---:|:---:|
|参数个数|  
|  
|  
|
|  
|1|0,2|  
|
|run_name|  
|  
|  
|
|  
|做过  DBMS_HM.RUN_CHECK测试中的  run_name|run_name非  DBMS_HM.RUN_CHECK检查过的|  
|
|  
|直接跟字符串，或者to_char()函数|由于健康检查超过上限被覆盖的run_name|  
|
|  
|  
|带特殊字符、空格、不带引号、大小不正确、null|  
|
|  
|  
|非字符类型的|  
|


- 如果未生成过报告，查询的时会把报告生成在屏幕，并且生成一个TEXT格式的报告


|场景|预期|备注|
|:---|:---|:---|
|未生成过报告，执行  DBMS_HM.GET_RUN_REPORT|查询的时会把报告生成在屏幕，并且生成一个TEXT格式的报告|  
|
|已经有报告存在，执行  DBMS_HM.GET_RUN_REPORT|不会再次生成报告|  
|
|删除已经生成的报告，再执行  DBMS_HM.GET_RUN_REPORT|会再次生成报告|  
|
|多次重复执行查询同一个健康检查|都会成功，不会再次生成报告|  
|
|查询一个很久之前进行过健康检查的报告|能查询出来|  
|
|健康检查被覆盖后查询|查询不到|  
|


3、并发测试

  


|场景|预期|备注|
|:---|:---|:---|
|对于涉及到的相关视图需要进行并发测试（视图查询并发、健康检查和视图查询并发）|  
|  
|
|健康检查和DML、DDL并发|  
|健康检查会加锁|


# 4.   **详细测试设计**   

[集群支持ADR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWNhMWFkOWEzMzExZGM3OWE5IiwicmVmX2lkIjoiNjczOTY5ZWI1OTNmOTljOWZmMjM1NDI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDE0LCJleHAiOjE3ODIyOTY0MTR9.B8gKDAl0qaJncDi2EXJuJYcoNBg5cnlZO1ccgB-txEE)

# 5.   **测试用例**

[ADR测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWNhMWFkOWEzMzExZGM3OWFhIiwicmVmX2lkIjoiNjczOTY5ZWI1OTNmOTljOWZmMjM1NDI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDE0LCJleHAiOjE3ODIyOTY0MTR9.ulX3JTmQQvGiQ2C6lzR729u8nKjUIuLH9svMS8IQq54)

# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[支持ROWID数据类型测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWNhMWFkOWEzMzExZGM3OWFiIiwicmVmX2lkIjoiNjczOTY5ZWI1OTNmOTljOWZmMjM1NDI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDE0LCJleHAiOjE3ODIyOTY0MTR9.-xA9k_UJ_s9rIQCNkZTSboNMk8IO6ufoLFKkzQUcgU4)

 (application/vnd.xmind.workbook)    


[集群支持ADR.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWNhMWFkOWEzMzExZGM3OWE5IiwicmVmX2lkIjoiNjczOTY5ZWI1OTNmOTljOWZmMjM1NDI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDE0LCJleHAiOjE3ODIyOTY0MTR9.B8gKDAl0qaJncDi2EXJuJYcoNBg5cnlZO1ccgB-txEE)

 (application/octet-stream)    


[ADR测试用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZWNhMWFkOWEzMzExZGM3OWFhIiwicmVmX2lkIjoiNjczOTY5ZWI1OTNmOTljOWZmMjM1NDI2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwMDE0LCJleHAiOjE3ODIyOTY0MTR9.ulX3JTmQQvGiQ2C6lzR729u8nKjUIuLH9svMS8IQq54)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
