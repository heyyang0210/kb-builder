Created by 王莹, last modified on 十一月 14, 2023

# **1. 概述**

该需求对hash join 部分场景的内存做出优化，具体场景见开发设计文档

# **2. 需求分析**

**SR链接：**    [YDBRD-13175](https://jira.yasdb.com/browse/YDBRD-13175?src=confmacro)    **-**  **[列存计算] Hash join分配的物化内存不足时不能报错**  **完成**

  [Hash Join Memory Optimization - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?spaceKey=YAS&title=Hash+Join+Memory+Optimization)  

依据开发指定优化场景做相关测试

新增参数：  _COLUMNAR_MAX_BATCH_COUNT，决定分批的时候实际批次的最大值,如果内存不足时调整为最小值即可，不影响内存足够时的性能，范围2~65536，默认值1024

场景：

1.join key重复数据较多，使用的内存先写盘

2.批次较多时，避免元数据占用大量内存

约束：

该SR可以减少hash join使用的内存，但不能保证在任何条件下都能执行成功，无法减少其他算子以及存储使用的内存，只适用于部分包含hash join且内存不足的场景。

# **3. 测试**  **设计方法**   

本次测试设计主要采用场景法以及边界值方法验证

# 4.   **详细测试设计**

(1)功能

(2)专项

|专项|是否涉及|备注|
|:---|:---|---|
|并发|是|  
|
|性能|是|tpch，性能不能下降|


# 5.   **测试用例**

待补充

# **6 测试框架设计**

单机yasft框架

## Attachments:

[内存优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWU4OTcwYzJhZjRmNTFmN2E5IiwicmVmX2lkIjoiNjczOTY5NWU3MjgyMDZlZmI5MmVmMjUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2OTAyLCJleHAiOjE3ODIyMTMzMDJ9.x3E17fJP8AOt67x6NAqFMDzALxQe6Lo3QZbMoyt-2xE)

 (application/x-xmind)    
