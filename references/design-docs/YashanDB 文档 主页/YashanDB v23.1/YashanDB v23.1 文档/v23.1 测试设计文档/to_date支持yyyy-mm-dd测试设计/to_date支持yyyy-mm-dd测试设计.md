Created by 王莹, last modified on 十一月 14, 2023

# **1. 概述**

该需求满足to_date函数fmt的日期参数中没有连接符，如“yyyy-mm-dd”

# **2. 需求分析**

  [YDBRD-16726](https://jira.yasdb.com/browse/YDBRD-16726?src=confmacro)    **-**  **支持to_date(形同'20230606'的常量字符串/表列/过程体局部变量,'yyyy-mm-dd')**  **完成**

**开发设计文档：**    [to_date 支持('20121210','yyyy-mm-dd') - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119545417)  

to_date支持的格式符形式灵活，可以使用分隔符间隔，也可以不使用，当前需求支持 fmt为yyyy-mm-dd该格式符。

***实现按照如下优先匹配规则实现***

1、先判断str有无分隔符

2、再判断fmt有无分隔符

3、最终根据下一个fmt要匹配的字符去str查找，如果没分隔符则根据fmt类型取str的对应长度（如：yyyy取str的长度为4），oracle目前的长度无论有无分隔符是严格匹配

4、在匹配成功后，目前只对year相关长度进行校验

# **3. 测试**  **设计方法**   

本次测试设计主要采用场景法以及等价类方法验证

# 4.   **详细测试设计**

(1)功能

![](https://pingcode.yasdb.com/atlas/files/public/67396968a1ad9a3311dc7666/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFJQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcyMTUsImV4cCI6MTc4MjEzODAxNX0.VSNoOQhtgWsQkeZL7QmrJGKvzPSgq1KkOqvxJQC8q6s)

（2）专项

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|


# 5.   **测试用例**

待补充

# **6 测试框架设计**

单机yasft框架

## Attachments:

[to_date支持yyyymmdd.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Njg4OTcwYzJhZjRmNTFmN2YxIiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzA0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjE1LCJleHAiOjE3ODIyMTM2MTV9.pwyQpZ6y-l6p5LnOiCPlnEhn-OKOyKTdyFuy-Q8imr8)

 (application/x-xmind)    
