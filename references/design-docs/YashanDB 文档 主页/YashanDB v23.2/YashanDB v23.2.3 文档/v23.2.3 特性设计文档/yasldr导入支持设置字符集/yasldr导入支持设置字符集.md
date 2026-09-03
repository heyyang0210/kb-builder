Created by 程康, last modified on 六月 19, 2024

  


*IR链接：*  *YDBRD-16092*

*SR链接：*  *YDBRD-22277*

##   [1. 总述](#1-总述)  

当客户端解析字符集与文件编码字符集不同时，导入后会出现乱码。

需要支持可以在yasldr 参数中配置导入的字符集，即指定客户端解析字符集，以达到不出现乱码的情况。

###   [1.1 需求来源](#11-需求来源)  

当文件和目标端数据库的字符集为GBK，使用yasldr工具需要读取yasc_env.ini文件，并需要在文件指明CHARACTER_SET=GBK才能导入成功，将字符集作为yasldr的配置项

###   [1.2 调研文档](#12-调研文档)  

oracle在上述情况下的表现为：

  [yasldr 支持设置字符集 -- 调研文档 - 程康 - SICS-CoD Confluence (yasdb.co](https://conf.yasdb.com/pages/viewpage.action?pageId=144113763)  

|   字符集   |   配置原则   |    
  |------------|-------------------------------------------------------------------------------------|    
  |   GBK   |   如数据库只需要支持中文，数据量很大，性能要求也很高，建议选择双字节定长编码的中文字符集  GBK  。   |    
  |   UTF-8   |   如应用程序需要处理各种各样的文字，或者需要将处理结果发布到不同语言的国家或地区，建议选择  Unicode  字符集，即  UTF-8  。此项为  YashanDB  推荐和默认的字符集。   |    
  |   ASCII   |   如数据库只需要支持  ASCII  收录的拉丁系字符，如英语和一些西欧语言，则可以选择  ASCII  字符集。   |    
  |   ISO-8859-1   |   此字符集为单字节编码，能表示的字符范围是  0-255  ，仅应用于全英文场景。   |    
  |   GB18030   |   此字符集达到  GB18030-2022  标准的实现级别三。如果数据库有大量使用中文的场景，且对生僻字的显示、处理、输出有比较严格的要求，可以选择此字符集。   |

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

|**接口**|**接口表现**|**接口说明**|**是否涉及**|
|---|---|---|---|
|配置参数|character_set|配置客户端解析csv文本的字符集|是|


##   [3. 规格与约束](#3-规格与约束)  

  


配置参数character_set

可选范围：UTF8、GBK、ASCII、ISO88591、GB18030

```
yasldr ck/1@127.0.0.1:1688 control_file=/exp/ck_date.ctl character_set=GBK
yasldr ck/1@127.0.0.1:1688 control_file=/exp/ck_date.ctl character_set=UTF8
```

##   [4. 特性](#4-特性)  

###   [4.1 特性设计](#41-特性设计)  

字符集转换包括 varEnv的类型转换、c驱动的插入时转换、分区键计算时的转换

配置参数影响 数据文件的字符集，lob文件字符集（与orable一致），client配置影响控制文件字符集，若配置参数无，则client影响上述三个字符集

输出的bad、log文件的字符集 -- bad与csv字符集一致，log为终端字符集

设置不在范围内的字符集-- 异常提示

文件拆分后的字符集 – 与csv文件字符集一致

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

字母、数字不会乱码

针对 文本符号如汉字，假名，表情符号等进行测试

数据类型：char、varchar

          char2、varchar2

          lob

部署形态：单机、分布式

##   [6.资料设计章节](#6资料设计章节)  

增加资料描述，新增了yasldr的参数配置

##   [7.未来规划](#7未来规划)  

  


yasldr 字符集转换 性能下降较为明显

目前依赖 c驱动的转换，单行数据调用一次系统函数 iconv，总计会多次调用iconv_open，耗时严重

![](https://pingcode.yasdb.com/atlas/files/public/67396d3da1ad9a3311dc8fc8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFJQUFBQUFBQUFBRkFBQUFBQUNBQUFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFRQUJBSWdBQUFGQVFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUFBQUFBQ0FBQUFBQUFBQUFnQUFFQUFCQUFJQUFBQUFBQWdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NjksImV4cCI6MTc4MjMxNzY2OX0.4pH_laRrmmVw29lYQTGzxfdyXfoWX1VoBO0dxu8izxo)

  


修改：

textStreamConvertCharsetWithIconv 新增入参iconv_t，来自conn，在putStrText时open一次

conn 断开时，在yacFreeHandle close

yacSetEnvAttr？

  


测试：

服务端gbk，纯ascii文本导入

修改前：

不转换

![](https://pingcode.yasdb.com/atlas/files/public/67396d3da1ad9a3311dc8fc9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFJQUFBQUFBQUFBRkFBQUFBQUNBQUFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFRQUJBSWdBQUFGQVFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUFBQUFBQ0FBQUFBQUFBQUFnQUFFQUFCQUFJQUFBQUFBQWdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NjksImV4cCI6MTc4MjMxNzY2OX0.4pH_laRrmmVw29lYQTGzxfdyXfoWX1VoBO0dxu8izxo)

转换：

![](https://pingcode.yasdb.com/atlas/files/public/67396d3da1ad9a3311dc8fca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFJQUFBQUFBQUFBRkFBQUFBQUNBQUFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFRQUJBSWdBQUFGQVFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUFBQUFBQ0FBQUFBQUFBQUFnQUFFQUFCQUFJQUFBQUFBQWdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NjksImV4cCI6MTc4MjMxNzY2OX0.4pH_laRrmmVw29lYQTGzxfdyXfoWX1VoBO0dxu8izxo)

修改后：

不转换

![](https://pingcode.yasdb.com/atlas/files/public/67396d3d8970c2af4f52115b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFJQUFBQUFBQUFBRkFBQUFBQUNBQUFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFRQUJBSWdBQUFGQVFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUFBQUFBQ0FBQUFBQUFBQUFnQUFFQUFCQUFJQUFBQUFBQWdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NjksImV4cCI6MTc4MjMxNzY2OX0.4pH_laRrmmVw29lYQTGzxfdyXfoWX1VoBO0dxu8izxo)

转换

![](https://pingcode.yasdb.com/atlas/files/public/67396d3ea1ad9a3311dc8fcb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUlBQUFJQUFBQUFBQUFBRkFBQUFBQUNBQUFBQUFBQUFBQUFBQWdBQUFBQUNBQUFBQUFBQUFBQUFRQUJBSWdBQUFGQVFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQW9BQUFBQUFBQUFBQ0FBQUFBQUFBQUFnQUFFQUFCQUFJQUFBQUFBQWdBZ0FBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY4NjksImV4cCI6MTc4MjMxNzY2OX0.4pH_laRrmmVw29lYQTGzxfdyXfoWX1VoBO0dxu8izxo)

  


  


  


## Attachments:

[image2024-1-19_16-9-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2Q4OTcwYzJhZjRmNTIxMTU1IiwicmVmX2lkIjoiNjczOTZkM2Q1OTNmOTljOWZmMjM3OTRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2ODY5LCJleHAiOjE3ODIzOTMyNjl9.sskyxFowftGWHnTQQzQGnrdy34m0hC8EiG-RhSpnU9Q)

 (image/png)    


[image2024-1-19_16-15-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2Q4OTcwYzJhZjRmNTIxMTU2IiwicmVmX2lkIjoiNjczOTZkM2Q1OTNmOTljOWZmMjM3OTRiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2ODY5LCJleHAiOjE3ODIzOTMyNjl9.r-KDXqSh7UsXLl50r13TMu6jsDNslHKgAyftFK8roj0)

 (image/png)    


## Comments:

|  [](null)  ,1、UTF-16 不支持,2、  ASCII 本身能表示的字符 的测试,3、yasldr 减 驱动,Posted by chengkang at 一月 23, 2024 10:16|
|---|
|  [](null)  ,1、oracle 导入工具设置字符集,2、输出的bad、log文件的字符集,3、csv文件和lob文件字符集不同，ctl文件字符集解析（需保证与csv相同的字符集）,4、打包到客户端？,5、大小端 – 不涉及,6、文件拆分后的字符集 – 与原始csv文件的字符集一致 ,7、设置不在范围内的字符集 – 抛出,Posted by chengkang at 五月 11, 2024 14:32|
|  [](null)  ,1、这个和服务端字符集有什么关联 -- 最终转换成服务端字符集    
  2、中文年月日格式 -- 配置文件    
  3、json、xmltype --    
  4、列名col 打屏观察乱码 – client gbk，  ctl gbk 含有中文非法列名，linux下导入会utf8 显示 ctl的非法列名，是乱码    
  5、对比oracle lob    
  -    
  6、分区表,Posted by chengkang at 五月 13, 2024 16:23|
