Created by 易文亮, last modified on 一月 03, 2024

# 1. 概述

*本文档描述LSC主备复制重构的测试设计*

*冷数据存在slice文件中，*  *slice文件既是redo也是data，其与某条redo保证逻辑关联，主备数据同步时，先发送slice文件给备机，发送成功后，主机记录同步完成的redo，再记swd redo，最后主机事务提交，备机回放时，先回放slice redo，再回放swd元数据。*

相比之前采用私有的发送线程进行归档数据同步，新框架由于备机回放点后续的slice同步任务都被加载到sender的manager上，因此FAL只需要检查对应asn的redo日志的最小lfn是否大于等于manager上最小lfn，一旦区间内的slice都同步完成，对应的归档redo也可进行同步。

# 2. 需求分析

## SR连接：    [YDBRD-21755](https://jira.yasdb.com/browse/YDBRD-21755?src=confmacro)    -  LSC主备发送重构优化  完成

开发设计：    [【Spearfish】scf框架调整 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133593955)  

相关功能测试设计：

  [*LSC支持主备复制测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76928724)  

  [HA - LSC主备复制性能测试](https://conf.yasdb.com/pages/viewpage.action?pageId=85108394)  

## 2.1 功能点分析

- *在原主备复制的基础上，原方案slice生成后才会以文件方式往备机发送，新方案会从内存发送*
- *新增视图*  *v$slice_replicate_stats*


|0|DEST_ID|备机ID，与ARCHIVE_DEST_x参数相对应|
|:---|:---|:---|
|1|BUCKET_NAME|同步文件所在Bucket路径|
|2|DATAOBJ|同步文件所属对象id|
|3|SLICE_ID|同步文件编号|
|4|PROGRESS|发送进度=已发送size/slice的size|
|5|SPEED|发送速率=已发送size/发送耗时(M/s)|
|6|EXEC_ROUND|同步任务执行轮次 EXEC_ROUND-1为此任务失败次数|


## 2.2 应用场景

- *构造大量slice转换和合并，主备同步发送的场景*
- *确认冷数据的slice同步过程中视图的状态迁移过程逻辑正确*


## 2.3 规格约束

- 无


# 3. 详细测试设计

## 3.1 测试设计方法

*主备同步功能逻辑主要使用场景测试法*

*视图验证使用等价类结合场景测试法*

## 3.2 详细测试设计

1. *功能测试场景*


|序号|测试内容|结果|备注|
|---|---|---|---|
|1|构造大量小的slice，确认主备同步|同步正常|  
|
|2|构造大的slice，如128M，确认主备同步|同步正常|  
|
|3|视图字段名、数据类型确认|与预期一致|  
|
|4|视图逻辑验证：一主一备，确认DEST_ID|内容正确|  
|
|5|视图逻辑验证：一主二备，确认DEST_ID|内容正确|  
|
|6|视图逻辑验证：级联备，确认DEST_ID，备机查询|内容正确|  
|
|7|视图逻辑验证：默认路径bucket确认BUCKET_NAME|内容正确，记录路径|  
|
|8|视图逻辑验证：s3对象存储确认BUCKET_NAME|内容正确，  ~~s3不同步~~|  
|
|9|视图逻辑验证：确认发送进度、  发送速率|计算正确|  
|
|10|~~视图逻辑验证：分别构造备机异常、发生中、发生取消、发生完成，确认status~~,~~备机发送异常——删除备机databucket~~|状态正确|  
|
|11|视图逻辑验证：根据任务成功/失败，确认EXEC_ROUND逻辑|逻辑正确|  
|
|12|视图逻辑验证：记录变化逻辑，有slice同步任务新增，每个slice有且只有一条|发送时生成，发送完成记录清除|  
|
|13|构造大量slice转换、合并与视图查询变化|DB不异常|  
|
|14|构造4096、4W个以上个slice后备机断连后恢复，再同步|正常同步|  
|
|15|slice同步与视图查询并发|DB不异常|  
|
|16|slice发送增删链路|  
|  
|


        2. 性能测试场景

构造100G的slice数据，确认测试包同步耗时与master版本同步耗时比。一主一备、一主2备

配置线程数，改大线程，发送性能会有提升。

|系统级DFX分类|是否涉及|备注|
|:---|:---|---|
|CT|是|  
|
|KT|是|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否|  
|
|DFR|是|  
|
|HA|是|  
|
|压力|否|  
|
|性能|是|  
|
|可维护性|否|  
|


  


# 4. 测试用例

1. 冒烟文本用例：
1. 测试文本用例：


[LSC主备重构门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGY4OTcwYzJhZjRmNTIwNzkxIiwicmVmX2lkIjoiNjczOTZiZGY1OTNmOTljOWZmMjM2N2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQ2LCJleHAiOjE3ODIzODM5NDZ9.3XswB1qS8cGL81VmXgDUDrR2tHlNNjYrviHm684u25Q)

详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *5人天*

计划测试完成时间：

## Attachments:

[LSC主备重构门槛用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZGY4OTcwYzJhZjRmNTIwNzkxIiwicmVmX2lkIjoiNjczOTZiZGY1OTNmOTljOWZmMjM2N2RlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NTQ2LCJleHAiOjE3ODIzODM5NDZ9.3XswB1qS8cGL81VmXgDUDrR2tHlNNjYrviHm684u25Q)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,1、模式：旧的只支持silo，新模式4种都支持，补充用例,2、多线程发送配置，明确后补充测试点,Posted by yiwenliang at 十二月 20, 2023 16:28|
|---|
|  [](null)  ,会议纪要：,参会人：万谦、谢锐、易文亮、马志宏,需补充的测试点：,1、验证4种_SCOL_SLICE_LAYOUT=【silo|ROWGROUP|SLICE|COLUMN】主备发送功能，原来只支持silo,2、  构造4096、4W个以上个slice，备机断连再恢复，确认主备同步功能,3、slice发送过程中增删链路,4、修改同步线程配置，确认对同步性能影响,待确认：同步线程配置参数,Posted by yiwenliang at 十二月 20, 2023 19:03|
|  [](null)  ,同步线程配置参数，SCOL_REPL_WORKERS，范围【1,32】，默认值，重启生效。,Posted by yiwenliang at 十二月 20, 2023 19:04|
