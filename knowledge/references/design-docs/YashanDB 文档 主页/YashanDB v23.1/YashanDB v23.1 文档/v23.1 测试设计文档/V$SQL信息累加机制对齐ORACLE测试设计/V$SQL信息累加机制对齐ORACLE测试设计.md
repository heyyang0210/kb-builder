Created by 韩晓盼, last modified on 十月 16, 2024

SR：    [](https://jira.yasdb.com/browse/YDBRD-16641)      [YDBRD-16641](https://jira.yasdb.com/browse/YDBRD-16641?src=confmacro)    -  V$SQL信息累加机制对齐ORACLE  完成

# 1.   **概述**

简要说明需求背景，本文范围如下：

（1）v$sql信息累加机制需要调整两个场景，一个是执行top_level_sql时（调用package，so，job等），v$sql中执行次数只统计sql本身，不累加调用对象执行的sql。另一个是在sql开始执行时，就需要实时把执行时间同步到v$sql中。

# 2.   **需求分析**

##### 2.1 基本特征

- 功能分析    


       sql执行的时间、次数等对齐oracle的累加机制，除ddl外的所有语法都会统计累加   

# 3.   **测试设计方法**

边界值，等价类，场景分析等。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

![](https://pingcode.yasdb.com/atlas/files/public/673969698970c2af4f51f7f3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcyMzYsImV4cCI6MTc4MjEzODAzNn0.QW58J-WSNsxk_Ni1VO9kXyQQ1fuHdToVZ_X6BCCccec)

[v$sql统计累加机制对齐oracle.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjhhMWFkOWEzMzExZGM3NjY3IiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjM2LCJleHAiOjE3ODIyMTM2MzZ9.g9UnW57gKHqBGQskgeZXC3WyGvLAIXQT0vi0N9q70GM)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|否|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

详见：    [standalone/testcase/system_view/test_sdv_VSQL_Accumulation · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/system_view/test_sdv_VSQL_Accumulation)  

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[v$sql统计累加机制对齐oracle.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjhhMWFkOWEzMzExZGM3NjY3IiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjM2LCJleHAiOjE3ODIyMTM2MzZ9.g9UnW57gKHqBGQskgeZXC3WyGvLAIXQT0vi0N9q70GM)

 (application/x-xmind)    


[image2023-5-9_11-26-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjlhMWFkOWEzMzExZGM3NjY5IiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjM2LCJleHAiOjE3ODIyMTM2MzZ9.f38qVbMSUixsWXEDYK3juEN3KJuhZ__fY1kdi3tT3U4)

 (image/png)    


[image2023-5-11_11-3-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Njk4OTcwYzJhZjRmNTFmN2YyIiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzBlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjM2LCJleHAiOjE3ODIyMTM2MzZ9.jQ8qWsVwa9s2sLXQfiJ109cQE0Dewmh9AsyrZ6PmDjs)

 (image/png)    
