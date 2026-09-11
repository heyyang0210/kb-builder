Created by 陈钦卿, last modified on 五月 09, 2024

# 1. 概述

SR：    [https://pingcode.yasdb.com/pjm/items/661156fc579a3edb84d68ead](https://pingcode.yasdb.com/pjm/items/661156fc579a3edb84d68ead)    ?#YDBRD-19209 【yasldr】支持指定单字节分隔符和包围符

开发设计：    [yasldr 支持单字节分隔符和包围符 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144131150)  

测试调研：    [YDBRD-17049 测试调研（oracle） - 范瑜 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150604080)  

交付形态：单机

# 2. 需求分析

## 2.1 功能点分析

FIELDS TERMINATED BY 'fields_terminated_char'

- 分隔符 支持可见的单字节，不包含英文字母和数字  （ascii：32-47，58-64，91-96，123-126）


OPTIONALLY ENCLOSED BY 'enclosed_by_char'

- 包围符 支持可见的单字节，包含英文字母和数字   （1-126，除10换行，除32空格）


## 2.2 规格约束

- 包围符 与 分隔符不能相同
- 服务端同样支持
- 不支持多字符


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略*

*如：内置函数入参–边界值；等价类*

*语法图–路径覆盖*

## 3.2 详细测试设计

1. *使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*
1. *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*


  


|输入条件一|输入条件二|有效等价类|无效等价类|备注|
|---|---|---|---|---|
|基本功能验证|分隔符/包围符|分别遍历所有可见单字节字符,**单引号使用转义：‘ → ‘’**,**双引号使用转义：” → \"**,**反引号使用转义：` → \`**,**空格仅支持10进制/16进制输入**|多字符、字母、表情、二进制、  重复指定|1、指定方式：字符、十进制、十六进制。单引号包围十进制/十六进制报错，双引号包围正常导入。,2、  若空格作为分隔符，空格为数据时如何导入？trim掉数据列起始的空格时如何处理？,3、  **shell中对感叹号有特殊处理：shell中 ! 叫做事件提示符,Event Designator,可以方便的引用历史命令,即history中记录的命令**,  [shell中 ! exclamatory mark感叹号详解 - ascertain - 博客园 (cnblogs.com)](https://www.cnblogs.com/dissipate/p/13788632.html)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396cef8970c2af4f520f32/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQWdBQVFBQUFBQUFBZ0FBZ0FBQUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUVBQUFBRUFBQWdJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQVFBQUFCQUFBQUJBQUFBQUFBQkFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4MDMsImV4cCI6MTc4MjMxNTYwM30.mt1qvADTycS4oR7IELgAAiBTzaQI48Mn8P0xn2QB_3A)|
|  
|分隔符和包围符正交组合|  
|分隔符和包围符相同|1、仅指定分隔符：包围符默认为双引号,2、仅指定包围符：分隔符默认为逗号|
|csv内容|实际分隔符与指定分隔符对应关系|分隔符与指定相同|分隔符与指定的不同|按照算法构造csv数据|
|  
|实际包围符与指定包围符对应关系|包围符与指定相同|包围符与指定的不同|  
|
|  
|包围符与分隔符间存在其他字符|  
|  
|  
|
|  
|包围符不完整|  
|  
|  
|
|  
|分隔符与列数不匹配|  
|  
|  
|
|  
|列数据中出现包围符|  
|  
|包围符作为数据需要再加一个包围符转义|
|  
|列数据中出现分隔符|  
|  
|  
|
|指定方式|control_text|  
|  
|  
|
|  
|control_file|  
|  
|  
|
|与其他功能结合|with embedded|  
|  
|换行的位置是否为分隔符包围符换行符|
|  
|trim|  
|  
|  
|
|  
|多文件|指定不同的分隔符和包围符|  
|  
|
|  
|文件拆分|  
|  
|  
|
|  
|yasboot|  
|  
|yasboot load单引号作包围符/分隔符报错,![](https://pingcode.yasdb.com/atlas/files/public/67396cefa1ad9a3311dc8da3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQWdBQVFBQUFBQUFBZ0FBZ0FBQUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUVBQUFBRUFBQWdJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQVFBQUFCQUFBQUJBQUFBQUFBQkFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4MDMsImV4cCI6MTc4MjMxNTYwM30.mt1qvADTycS4oR7IELgAAiBTzaQI48Mn8P0xn2QB_3A),yasboot导入时指定包围符没有生效，导入结果不符合预期,![](https://pingcode.yasdb.com/atlas/files/public/67396cef8970c2af4f520f33/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQWdBQVFBQUFBQUFBZ0FBZ0FBQUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUVBQUFBRUFBQWdJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQVFBQUFCQUFBQUJBQUFBQUFBQkFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4MDMsImV4cCI6MTc4MjMxNTYwM30.mt1qvADTycS4oR7IELgAAiBTzaQI48Mn8P0xn2QB_3A),![](https://pingcode.yasdb.com/atlas/files/public/67396cef8970c2af4f520f34/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFJQWdBQVFBQUFBQUFBZ0FBZ0FBQUFBQUFBQUFBQUFBQUNCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUVBQUFBRUFBQWdJQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQVFBQUFCQUFBQUJBQUFBQUFBQkFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDQ4MDMsImV4cCI6MTc4MjMxNTYwM30.mt1qvADTycS4oR7IELgAAiBTzaQI48Mn8P0xn2QB_3A)|
|  
|lobfile、lls|file.dat.1.2/|  
|  
|
|  
|exp --csv|导出后导入|  
|  
|
|  
|大数据量|按照csv_chunk_size分割可能有问题，构造几个csv_chunk_size的数据，结合with embedded|  
|readers大于1|
|  
|服务端|nullif|  
|服务端分隔符为空格字符导入成功，与客户端不同|
|  
|集群、分布式|  
|  
|  
|


|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR|  
|  
|
|HA|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


[yasldr支持分隔符&包围符文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWY4OTcwYzJhZjRmNTIwZjJlIiwicmVmX2lkIjoiNjczOTZjZWU3MjgyMDZlZmI5MmYxOGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODAzLCJleHAiOjE3ODIzOTEyMDN9.ALZPcGLHB5MAOwV6V1S8Q3QLqsfQrVUdz56TpIb9wKc)

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


  


- 本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWZhMWFkOWEzMzExZGM4ZDlmIiwicmVmX2lkIjoiNjczOTZjZWU3MjgyMDZlZmI5MmYxOGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODAzLCJleHAiOjE3ODIzOTEyMDN9.AfeavVKmwp94nP8MOFecWg3bTUCRcSMAHFZQ9-TFCJ8)

## Attachments:

[详细测试设计文档模板.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWZhMWFkOWEzMzExZGM4ZDlmIiwicmVmX2lkIjoiNjczOTZjZWU3MjgyMDZlZmI5MmYxOGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODAzLCJleHAiOjE3ODIzOTEyMDN9.AfeavVKmwp94nP8MOFecWg3bTUCRcSMAHFZQ9-TFCJ8)

 (application/msword)    


[XXX功能测试设计.doc](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWZhMWFkOWEzMzExZGM4ZGEwIiwicmVmX2lkIjoiNjczOTZjZWU3MjgyMDZlZmI5MmYxOGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODAzLCJleHAiOjE3ODIzOTEyMDN9.PuOZ9WLAl9ra96jGsvKtiC1z4nFFc3ozgzKSopPr2gw)

 (application/msword)    


[yasldr支持分隔符&包围符文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWY4OTcwYzJhZjRmNTIwZjJmIiwicmVmX2lkIjoiNjczOTZjZWU3MjgyMDZlZmI5MmYxOGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODAzLCJleHAiOjE3ODIzOTEyMDN9.y7lBoG8gn9CAN9UlEkTxDMbY6dESp4rzvC0byzRQ91E)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[yasldr支持分隔符&包围符文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZWY4OTcwYzJhZjRmNTIwZjJlIiwicmVmX2lkIjoiNjczOTZjZWU3MjgyMDZlZmI5MmYxOGM1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0ODAzLCJleHAiOjE3ODIzOTEyMDN9.ALZPcGLHB5MAOwV6V1S8Q3QLqsfQrVUdz56TpIb9wKc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,YDBRD-19209【yasldr】支持指定单字节分隔符和包围符 测试设计评审纪要    
  与会人：陈钦卿、范瑜、贺国峰、程康    
  评审时间：2024.04.29 11:00:00    
  会议纪要：    
  1、确定范围    
  分隔符：（ascii：32-47，58-64，91-96，123-127）    
  包围符：（ascii：0-127，除10换行，除32空格）    
  2、csv数据需按照Oracle分割数据的算法构造    
  3、with embedded测试点需关注：换行的位置可能为分隔符包围符换行符；按照csv_chunk_size切分，reader大于1    
  4、服务端也要关注测试,Posted by chenqinqing at 四月 29, 2024 15:07|
|---|
