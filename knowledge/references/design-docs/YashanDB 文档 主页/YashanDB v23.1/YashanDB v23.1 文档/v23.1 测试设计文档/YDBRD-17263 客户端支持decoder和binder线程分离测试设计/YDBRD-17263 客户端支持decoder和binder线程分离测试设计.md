Created by 范瑜, last modified on 十一月 14, 2023

# **1. 概述**

本文描述客户端支持decoder和binder线程分离测试设计

# **2. 需求分析**

## 2.1需求

SR:      [YDBRD-17263](https://jira.yasdb.com/browse/YDBRD-17263?src=confmacro)    -  客户端支持decoder和binder线程分离  完成

开发设计：

  [SQL LOADER线程分离 Design - 朱月婷 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119544492)  

  [YDBRD-17263：线程分离特性开发 - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=119548285)  

## 2.2 功能描述

lsc表在bulkload模式下，多线程并行，对配置的要求较高，如参数SCOL_DATA_BUFFER_SIZE, COLUMNAR_VM_BUFFER_SIZE等。可能报错：YAS-04438 parallel server error: failed to alloc 66112 bytes

故减小做insert线程的个数，减少空间开销，新增一组线程binder。使得原有的decoder线程只负责数据解析及构造，新增binder线程负责数据插入。

## 2.3 功能限制

（1）只支持客户端

## 2.4 规格说明

yasldr命令行新增conn_pool_size参数

（1）取值范围：[1, 32]

（2）规则：

- 在用户设置CONN_POOL_SIZE值的情况下，该值以用户设置为准
- 在用户未设置CONN_POOL_SIZE值的情况下：（1）若DOP大于30，则该值为15 （2）若DOP大于10，则该值为10 （3）小于10， 则该值为5


# **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

# **4. 详细设计**

[yasldr线程分离测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTFhMWFkOWEzMzExZGM3ODBhIiwicmVmX2lkIjoiNjczOTY5YTE3MjgyMDZlZmI5MmVmNTVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODIwLCJleHAiOjE3ODIyOTQyMjB9.ixAKc48JSzeebj0oWBF5n1V6G9DwTqUwmevkgCq_4v4)

# 5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用导入导出测试框架实现，执行python脚本，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[yasldr线程分离测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTFhMWFkOWEzMzExZGM3ODBhIiwicmVmX2lkIjoiNjczOTY5YTE3MjgyMDZlZmI5MmVmNTVlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODIwLCJleHAiOjE3ODIyOTQyMjB9.ixAKc48JSzeebj0oWBF5n1V6G9DwTqUwmevkgCq_4v4)

 (application/x-xmind)    
