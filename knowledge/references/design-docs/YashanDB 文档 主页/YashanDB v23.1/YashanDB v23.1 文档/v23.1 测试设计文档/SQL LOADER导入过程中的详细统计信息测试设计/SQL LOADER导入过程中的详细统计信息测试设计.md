Created by 李凯峰, last modified on 十一月 08, 2023

# 1.   **概述**

sr:    [YDBRD-13228](https://jira.yasdb.com/browse/YDBRD-13228?src=confmacro)    -  SQL LOADER导入过程中的详细统计信息  完成

设计文档：    [SQL LOADER统计信息设计文档 - 朱月婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=118587966)  

# 2.   **需求分析**

**统计信息方便用户查看资源使用情况，对于资源不足的报错可以进行调整，以及在一些性能要求较高的场景中可以用于参数调优；从开发的方面来说如果出现问题，也方便定位**

- 新增参数  statistics=/true/false
- 用户可以根据统计信息来调整参数提高导入性能


# 3.   **测试设计方法**

主要采用的等价类划分，边界值  ，场景法组合及错误推测法进行设计

4.   **详细测试设计**

  


1）

[SqlLoader导入过程消耗统计信息.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjZhMWFkOWEzMzExZGM3NjVkIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.SDwA_aR3JxpOxViTjEd2Zr_VVuwSDxjIEqPRIG6QmeI)

|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|语法测试|stats=true,stats=false,=两侧有空格,stats拼写错误,  
|  
|入参：,1.中文,2.特殊符号,3.非true/false的常量，如0/1|  
|
|表类型|heap、tac、lsc|  
|  
|  
|
|分区|hash、range、list、interval|  
|  
|  
|
|非分区表|  
|  
|  
|  
|
|配合参数使用|配合其他参数一起使用，如：,1.logging,2.nologging ,3.  enable_bulk=true/false(bcp),4.silent=true/false|  
|  
|  
|
|统计信息|1.行数：全部导入成功、部分导入成功、全部失败,2.线程数：reader、decoder、  degree_of_parallelism、decoder_thread_times,2.关注cpu：无数据、大量数据、少量数据、CPU利用率过高，如：80%,3.内存使用率过高：80%,4.reder线程：文件IO时间、文件buffer大小,5.decode线程：时间、内存、commit_rows,6.数据类型：覆盖已有数据类型,7.存储相关信息|  
|  
|  
|
|配合其他特性一起使用|如：,outline lob,文件拆分,LLS导入等|  
|  
|  
|
|交付形态|单机、分布式|  
|  
|  
|


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|涉及|
|HA|不涉及|
|压力|不涉及|
|性能|涉及|
|可维护性|涉及|


性能未出现下降，符合预期

  


# 5.   **测试用例**

  


[SqlLoader导入过程消耗统计信息.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjZhMWFkOWEzMzExZGM3NjVkIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.SDwA_aR3JxpOxViTjEd2Zr_VVuwSDxjIEqPRIG6QmeI)

# 6.   **测试框架设计**

1. 使用GUIDER框架即可


# 7.   **测试环境说明**

|服务器类型|os|  
|
|:---|:---|:---|
|vm|centos|单机/集群|


  


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2U5IiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.XcF-90OUG2GC_EDyS7wr578apqLpUwg4IKi3KMqRZWU)

## Attachments:

[配置参数打印到run.log日志.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjZhMWFkOWEzMzExZGM3NjVmIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.GqXbnyqxxhujYJPQQjcez3aPeWif8XgK9AyQ3Dj6AQI)

 (application/x-xmind)    


[check.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2VhIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.Nc_ufR5U1MDExFB4c9gbM45S0Bryj7BqCgdKkSQajTU)

 (image/svg+xml)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjY4OTcwYzJhZjRmNTFmN2U5IiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.XcF-90OUG2GC_EDyS7wr578apqLpUwg4IKi3KMqRZWU)

 (application/msword)    


[YDBRD-21634行存支持length2函数.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjdhMWFkOWEzMzExZGM3NjYwIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.cTp8P2Y0Bgr0jqFzUR6cpeAq3n1iJiVtIsmDtau6FFA)

 (application/x-xmind)    


[SqlLoader导入过程消耗统计信息.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjdhMWFkOWEzMzExZGM3NjYxIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.1jBURZxlMkGeJVeEIt3Tbl4hIwANMnURqHa_DIFPtzY)

 (application/x-xmind)    


[SqlLoader导入过程消耗统计信息.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjZhMWFkOWEzMzExZGM3NjVkIiwicmVmX2lkIjoiNjczOTY5NjY3MjgyMDZlZmI5MmVmMmQ0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MTc3LCJleHAiOjE3ODIyMTM1Nzd9.SDwA_aR3JxpOxViTjEd2Zr_VVuwSDxjIEqPRIG6QmeI)

 (application/x-xmind)    
