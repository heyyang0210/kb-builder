Created by 胡晓畔, last modified on 十二月 11, 2023

# **1.**  ** **  **概述**

SR：

  [[YDBRD-1816] 支持C语言的External Procedures - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-1816?filter=12039&jql=project%20%3D%20YDBRD%20AND%20resolution%20in%20(Unresolved%2C%20%E5%AE%8C%E6%88%90%2C%20%E8%A2%AB%E5%90%A6%E5%86%B3%2C%20%E9%87%8D%E5%A4%8D%E6%8F%90%E4%BA%A4%2C%20%E6%97%A0%E6%B3%95%E5%86%8D%E6%AC%A1%E5%A4%8D%E7%8E%B0%2C%20Done%2C%20%E5%B7%B2%E6%92%A4%E9%94%80%2C%20%22%E9%9D%9E%E9%97%AE%E9%A2%98%2F%E9%87%8D%E5%A4%8D%E9%97%AE%E9%A2%98%22%2C%20%E5%B7%B2%E8%A7%A3%E5%86%B3%2C%20%E5%B7%B2%E5%85%B3%E9%97%AD)%20AND%20%E6%B5%8B%E8%AF%95%E8%B4%A3%E4%BB%BB%E4%BA%BA%20in%20(currentUser())%20ORDER%20BY%20status%20DESC%2C%20priority%20DESC%2C%20updated%20DESC)  

  [YDBRD-1816](https://jira.yasdb.com/browse/YDBRD-1816?src=confmacro)    -  支持C语言的External Procedures  完成

外置udf支持C语言

将C语言程序打包成动态链接库  （linux的.so文件，windows的.dll文件）  ，创建对应的library对象，  再在创建外置udf时使用该library对象，  调用外置udf时运行C语言函数，返回结果。

  


# **2.**  ** **  **需求分析**

开发文档：

  [extProc C调研](https://conf.yasdb.com/pages/viewpage.action?pageId=104229917)  

  [extProc C设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=104232941)  

  


需求规格限制：

1. External C语法中C函数名称最大长度64
1. 在c语言中，如果so被多人引用了，需要所有引用人都释放引用后so才从内存释放-- 这个引用需要library执行过一个外置udf后，在yex_server上进行引用；若不满足则修改C代码不生效
1. C语言异常测试除0，表现是yex core，与Java的抛出除0 异常不同


# **3.**  ** **  **详细测试设计**

1.语法结合视图查询

2.yex_server 异常测试

3.C语言异常测试：死循环，大内存，除0

4.yep接口

覆盖 入参，出参，返回值接口组，重点覆盖出参接口组    
  yepXXXBool    
  yepXXXInt8    
  yepXXXInt16    
  yepXXXInt32    
  yepXXXInt64    
  yepXXXDate    
  yepXXXTimestamp    
  yepXXXYMInterval    
  yepXXXDSInterval    
  yepXXXfloat    
  yepXXXdouble    
  yepXXXNumber    
  yepXXXString    
  yepXXXBytes    
  考虑接口的正常/异常场景使用    
  考虑入参 出参接口组的下标ID 边界    
  考虑参数个数[maxsize 的varchar类型 ]    
  考虑协议包有128K的bufsize[边界值8 ]

5.覆盖数据类型，匹配 不匹配 可隐式转换 不可隐式转换的场景

6.特殊值

7.覆盖不同表类型下的udf引用

8.主备

9.并发

10.Windows ddl动态库

![](https://pingcode.yasdb.com/atlas/files/public/6739696b8970c2af4f51f7fe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjczMjEsImV4cCI6MTc4MjEzODEyMX0.j4PwZvhPAMBlZDr6bX8yXMrH5WXewlcgfpbpzMbRiBY)

[外置udf支持C语言测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmJhMWFkOWEzMzExZGM3NjczIiwicmVmX2lkIjoiNjczOTY5NmI3MjgyMDZlZmI5MmVmMzIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MzIxLCJleHAiOjE3ODIyMTM3MjF9.pRloaDScr_iS1V1AZxMaKWEo1bGCmCnWr3Mr4Zj_y3I)

|专项|是否涉及|
|:---|:---|
|并发|√|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|√|
|HA|√|
|压力|否|
|性能|否|
|可维护性|否|


# **4.**  ** **  **测试用例**

  


  [standalone/testcase/plsql_DBMS_external/external_procedures_C · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/plsql_DBMS_external/external_procedures_C)  

# **5.**  ** **  **测试框架**

单机：Guider+ yasft框架

分布式：Codbase_test

# **6.**  ** **  **测试环境说明**

VM  CentOS Linux release 7.9.2009  3.10.0-1160.el7.x86_64  

CPU GenuineIntel  Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz

单机normal

## Attachments:

[外置udf支持C语言测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmJhMWFkOWEzMzExZGM3NjczIiwicmVmX2lkIjoiNjczOTY5NmI3MjgyMDZlZmI5MmVmMzIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MzIxLCJleHAiOjE3ODIyMTM3MjF9.pRloaDScr_iS1V1AZxMaKWEo1bGCmCnWr3Mr4Zj_y3I)

 (application/x-xmind)    
