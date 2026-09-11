Created by 郑思远, last modified by  施新华 on 十二月 12, 2023

# 1.   **概述**

本文描述 jdbc支持directExecute绑定参数测试设计

# 2.   **需求分析**

  [YDBRD-21446](https://jira.yasdb.com/browse/YDBRD-21446?src=confmacro)    **-**  **【jdbc】支持directExecute绑定参数**  **完成**  **，**    [YDBRD-21752](https://jira.yasdb.com/browse/YDBRD-21752?src=confmacro)    **-**  **【jdbc】支持directExecute绑定参数**  **完成**

设计文档  **：**    [DirectExecute支持绑定执行 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=127633435)  

directExecute表示客户端与服务端只交互一次，客户端发送sql，服务端执行 prepare，execute后返回结果。

PrepareStatement 的方法没有变化

# 3.   **测试设计方法**

1.测试参数配置

2.改配置跑CI

3.测试性能

4.推导为unknown类型的场景

# 4.   **详细测试设计**

1.测试参数配置  clientPrepare

|  
|配置方式|配置值|备注|
|---|---|---|---|
|1|url  配置参数|true|  
|
|2|  
|false|  
|
|3|  
|默认|  
|
|4|YasConnection接口扩展方法|true|  
|
|5|  
|false|  
|
|6|  
|默认|  
|


  


2.改配置跑CI

利用上车工程，将工程中总的url的配置改成直接执行，跑CI    
  url的修改不合入公共仓

如果发现问题，问题用例再单独自动化

  


3.测试性能

在反复执行多次set和execute的场景下

对比直接绑定和非直接绑定的性能

  


4.测试查询投影列绑定参数推导为unknown类型的场景

例如  select ? from dual

覆盖各种数据类型

  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

[YDBRD-21446 jdbc支持directExecute绑定参数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWRhMWFkOWEzMzExZGM4NDNhIiwicmVmX2lkIjoiNjczOTZiOWM1OTNmOTljOWZmMjM2NGQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Nzc3LCJleHAiOjE3ODIzODIxNzd9.9ZF3BIBvTdc2d8hEP3pYTX9NglzJ8Z9bbi11rRknCmA)

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Attachments:

[YDBRD-21446 jdbc支持directExecute绑定参数.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOWRhMWFkOWEzMzExZGM4NDNhIiwicmVmX2lkIjoiNjczOTZiOWM1OTNmOTljOWZmMjM2NGQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1Nzc3LCJleHAiOjE3ODIzODIxNzd9.9ZF3BIBvTdc2d8hEP3pYTX9NglzJ8Z9bbi11rRknCmA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,一个stmt下，执行多次，每次覆盖不同数据类型,Posted by zhengsiyuan at 十月 17, 2023 11:22|
|---|
|  [](null)  ,绑定参数查询,Posted by zhengsiyuan at 十月 17, 2023 17:33|
