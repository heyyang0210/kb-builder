Created by 王莹, last modified on 十一月 14, 2023

# **1. 概述**

该需求满足to_date函数fmt的日期参数中没有连接符，如“yyyymmdd hh.mi.ss.ff”

# **2. 需求分析**

  [YDBRD-14149](https://jira.yasdb.com/browse/YDBRD-14149?src=confmacro)    **-**  **DATE_FORMAT支持YYYYMMDD**  **完成**

  [YDBRD-14166](https://jira.yasdb.com/browse/YDBRD-14166?src=confmacro)    **-**  **DATE_FORMAT支持YYYYMMDD格式**  **完成**

**开发文档：**    [to_date 支持('20121210','yyyymmdd') - 徐伟 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=109583510)  

to_date支持的格式符形式灵活，可以使用分隔符间隔，也可以不使用，当前按客户需求按白名单形式支持yyyymmdd该格式符。

使用如下：

![](https://pingcode.yasdb.com/atlas/files/public/673969688970c2af4f51f7ed/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIxMjcyMDUsImV4cCI6MTc4MjEzODAwNX0.w2Sph55n7zI5rRHWWxGXtpuDf3WM59DVZqkYYuzvo6o)

  


# **3. 测试**  **设计方法**   

本次测试设计主要采用场景法以及等价类方法验证

# 4.   **详细测试设计**

(1)功能

[to_date支持yyyymmdd.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Njg4OTcwYzJhZjRmNTFmN2VjIiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjA1LCJleHAiOjE3ODIyMTM2MDV9.iDjeNrKBrc2XFLnJHlqFuR4sZ57EwDh_Kn9sHntGcP4)

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

[to_date支持yyyymmdd.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Njg4OTcwYzJhZjRmNTFmN2VjIiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjA1LCJleHAiOjE3ODIyMTM2MDV9.iDjeNrKBrc2XFLnJHlqFuR4sZ57EwDh_Kn9sHntGcP4)

 (application/x-xmind)    


[image2023-11-14_17-39-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NjhhMWFkOWEzMzExZGM3NjY0IiwicmVmX2lkIjoiNjczOTY5Njg3MjgyMDZlZmI5MmVmMzAwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3MjA1LCJleHAiOjE3ODIyMTM2MDV9.fxToTgAfW2UZTYiBMQKgbd_1n2CMEd6oGGzcCEpelZg)

 (image/png)    
