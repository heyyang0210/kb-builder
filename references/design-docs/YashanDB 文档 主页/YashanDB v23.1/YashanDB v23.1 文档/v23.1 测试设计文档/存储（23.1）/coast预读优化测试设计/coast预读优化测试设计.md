Created by 梁绮菁, last modified on 一月 23, 2024

# 1.概述

描述coast预读优化的测试设计

sr：

  [YDBRD-15199](https://jira.yasdb.com/browse/YDBRD-15199?src=confmacro)    -  【2023.1】coast预读优化  完成

设计文档：    [【Spearfish】Coast预读优化](109596383.html)  

# 2.需求分析

- 通过增加配置项scol_cacheable_scan_rows控制读取时数据是否放入cache
- 根据执行计划的记录数，当记录数>scol_cacheable_scan_rows值时，不会放入lsc data buffer，<=scol_cacheable_scan_rows时会放入
- scol_cacheable_scan_rows范围[0,18446744073709551615]，默认值18446744073709551615
- 支持合并读优化，总是缓存到cache


# 3.测试设计方法

## 1.基本功能测试

采用边界值法测试基本功能

- scol_cacheable_scan_rows=0，查询一次、多次
- scol_cacheable_scan_rows=N
    - 计划行数<N
    - 计划行数=N
    - 计划行数>N


观测内容：每次查询后，观测v$sysstat中的hit、miss值的变化，预读后再次查询同样的语句，hit、miss值不会增加，没有预读则hit、miss每次都会增加

## 2.性能测试

使用tpch跑性能测试，观测不同场景下的性能是否有提升，tpch每条sql的计划行数大部分在33000以下

- tpch数据量：10G、100G
- scol_data_preloaders范围[0,256]
- scol_data_buffer_size范围[128M,2T]
- scol_cacheable_scan_rows范围：0、33000、18446744073709551615


观测内容：连跑5次tpch，观测每条sql每次执行时间

# 4.详细测试设计

![](https://pingcode.yasdb.com/atlas/files/public/673969de8970c2af4f51fb03/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFnQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMDk2NDIsImV4cCI6MTc4MjIyMDQ0Mn0.WQMjc1u8jD9300up0uMQI5IA-8rHDhuNjVUM0gZPcGY)

# 5.测试框架

使用yasft框架测试基本功能

# 7.测试环境

|版本|环境|
|---|---|
|linux|单机|


## Attachments:

[coast预读优化(ydbrd15199).xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZGVhMWFkOWEzMzExZGM3OTc4IiwicmVmX2lkIjoiNjczOTY5ZGU3MjgyMDZlZmI5MmVmODcwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA5NjQyLCJleHAiOjE3ODIyOTYwNDJ9.4Bm7ryVOH59FxRO-6ycU3UMFOc_CRtDr4iwchzvPoog)

 (application/x-xmind)    
