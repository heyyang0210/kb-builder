Created by 王莹 on 十月 31, 2023

# **1. 概述**

该需求对hash group 部分场景的内存做出优化，具体场景见开发设计文档

# **2. 需求分析**

**SR链接：**    [YDBRD-13176](https://jira.yasdb.com/browse/YDBRD-13176?src=confmacro)    **-**  **[列存计算] Hash Group/Distinct(Hash distinct)分配的物化内存不足时不能报错**  **完成**

  [Hash Group Memory Optimization - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Hash+Group+Memory+Optimization)  

依据开发指定优化场景做相关测试

  


约束

该SR可以在小内存场景下减少hash group/distinct使用的内存，但不能保证在任何条件下都能执行成功

# **3. 测试**  **设计方法**   

本次测试设计主要采用场景法以及边界值方法验证

# 4.   **详细测试设计**

(1)功能

场景1：group分组多，查询带聚集和聚集函数不带distinct（覆盖key值大或小）

场景2：hash group 带distinct

场景3：语句中不含group

场景4：投影列为21个8k,一个columnset为21M

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

[内存优化.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NWU4OTcwYzJhZjRmNTFmN2E1IiwicmVmX2lkIjoiNjczOTY5NWQ3MjgyMDZlZmI5MmVmMjRjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2ODgxLCJleHAiOjE3ODIyMTMyODF9.u-TUaI40m7lOFEbP0dK_E0x_jwLwb01jy52Cfr3We68)

 (application/x-xmind)    
