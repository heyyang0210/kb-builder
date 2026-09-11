Created by 李美娥, last modified on 十一月 07, 2023

# 1.   **概述**

SR：    [YDBRD-13629](https://jira.yasdb.com/browse/YDBRD-13629?src=confmacro)    -  分布式支持带子查询的update  完成

开发文档：    [分布式支持delete,update带子查询 - 林俊喆 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122070053)  

# 2.   **需求分析**

（1）分布式的lsc、tac表进行update操作时，支持子查询。

         跟单机的差异主要在于：

         1、仅支持非关联子查询，关联子查询报错(只要存在关联就报错，即使子查询里面关联的表跟外面update的表没有关系）

         2、单机多一些优化，就是in/exist/any/all会改写成join，提高执行效率；分布式不会转。

         3、单机的列存表的update和delete的子查询也是走的行执行器的，分布式下子查询是加了col2row走了列执行器（update、delete那一层一样，都是走的是行执行器）。

（2）子查询位置，从语法图可看出，需要关注单列update、多列update的子查询，关注where条件后的子查询。

![](https://pingcode.yasdb.com/atlas/files/public/673969d28970c2af4f51fabe/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFJUkFBQUVBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxOTEsImV4cCI6MTc4MjIxOTk5MX0.TqrV0WkvLbFza3abYGuCfXhGoyGiQduApFJO0v6uaTU)

![](https://pingcode.yasdb.com/atlas/files/public/673969d28970c2af4f51fabf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFJUkFBQUVBQUJBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDkxOTEsImV4cCI6MTc4MjIxOTk5MX0.TqrV0WkvLbFza3abYGuCfXhGoyGiQduApFJO0v6uaTU)

（3）修改的是表列，表列的各种类型需要覆盖（表列不能为分布键，若为分布键无法修改）

（4）表是复制表或者分布表、表是否含分区（分区关注具体的分区表类型，分布式不支持二级分区）、表是否带索引（索引的类别关注，主要关注被修改的表）

（5）被修改的表类型和子查询的表类型不一致，如一个是tac 一个是lsc。

结果验证：update后，select查询验证，结果跟单机比对。

# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

等价类，边界值，场景分析。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

[update支持子查询.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDJhMWFkOWEzMzExZGM3OTMxIiwicmVmX2lkIjoiNjczOTY5ZDI3MjgyMDZlZmI5MmVmN2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTkxLCJleHAiOjE3ODIyOTU1OTF9.fiynzWvRudmvizmPsJvMC9_bSer2UIPcE_3j0MRlgV0)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|是|
|HA|否|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例

[分布式update支持子查询_last.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDI4OTcwYzJhZjRmNTFmYWJiIiwicmVmX2lkIjoiNjczOTY5ZDI3MjgyMDZlZmI5MmVmN2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTkxLCJleHAiOjE3ODIyOTU1OTF9.HQm7yplFAg_9w60FefxuCdfgTerxqplPelcHzHadSsM)

# 6.   **测试框架设计**

  


# 7.   **测试环境说明**

## Attachments:

[update支持子查询.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDI4OTcwYzJhZjRmNTFmYWJjIiwicmVmX2lkIjoiNjczOTY5ZDI3MjgyMDZlZmI5MmVmN2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTkxLCJleHAiOjE3ODIyOTU1OTF9.Yfi7oAM268quhHtIr9e2zvpmobBsYzJJVgvJmJ2C4N8)

 (application/x-xmind)    


[分布式update支持子查询_last.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDI4OTcwYzJhZjRmNTFmYWJiIiwicmVmX2lkIjoiNjczOTY5ZDI3MjgyMDZlZmI5MmVmN2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTkxLCJleHAiOjE3ODIyOTU1OTF9.HQm7yplFAg_9w60FefxuCdfgTerxqplPelcHzHadSsM)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[update支持子查询.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZDJhMWFkOWEzMzExZGM3OTMxIiwicmVmX2lkIjoiNjczOTY5ZDI3MjgyMDZlZmI5MmVmN2UwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5MTkxLCJleHAiOjE3ODIyOTU1OTF9.fiynzWvRudmvizmPsJvMC9_bSer2UIPcE_3j0MRlgV0)

 (application/x-xmind)    
