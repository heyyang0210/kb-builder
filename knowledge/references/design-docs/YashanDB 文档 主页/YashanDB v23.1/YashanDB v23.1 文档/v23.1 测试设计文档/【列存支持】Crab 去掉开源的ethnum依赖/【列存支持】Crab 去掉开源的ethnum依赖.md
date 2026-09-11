Created by 鄢红亮 on 十一月 14, 2023

  [YDBRD-7674](https://jira.yasdb.com/browse/YDBRD-7674?src=confmacro)    -  【列存支持】Crab 去掉开源的ethnum依赖  完成

# **1. 概述**

- 整改开源库，去掉decimal-rs中的ethnum依赖。


# **2. 需求分析**

## 1. 功能描述

重新实现U256类型，去掉ethnum依赖

# **3. 测试设计方法**

**补充number类型溢出场景的计算**

**主要采用的等价类划分，边界值**  **，场景法组合及错误推测法进行设计**

|Crab 去掉开源的ethnum依赖测试设计|number类型溢出场景补测|溢出场景|  
|  
|
|---|---|---|---|---|
|||可能溢出场景|  
|  
|
||部署|分布式|表类型|lsc|
|||||tac|
|||单机|表类型|lsc|
|||||tac|
||算数运算符|+-*/|  
|  
|
||聚合函数|avg|  
|  
|
|||sum|  
|  
|
|||count|  
|  
|
|||max|  
|  
|
|||min|  
|  
|


  


# **4. 详细测试设计**

[Crab 去掉开源的ethnum依赖测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YThhMWFkOWEzMzExZGM3ODM0IiwicmVmX2lkIjoiNjczOTY5YTg3MjgyMDZlZmI5MmVmNWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MTg4LCJleHAiOjE3ODIyOTQ1ODh9.IV_zXdkf7hELYUpnJDW3QnFENRrqe6uXzJnHyn9XsgE)

# **5. 测试用例**

测试设计细化后的文本用例

详见：    [standalone/expect/dml1/crab · master · CoD-Test / yasft · GitLab (yasdb.com)](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/expect/dml1/crab)  

# **6. 测试框架设计**

1. **本次测试采用Guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。**


# **7. 测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机,分布式|


## Attachments:

[Crab 去掉开源的ethnum依赖测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YThhMWFkOWEzMzExZGM3ODM0IiwicmVmX2lkIjoiNjczOTY5YTg3MjgyMDZlZmI5MmVmNWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MTg4LCJleHAiOjE3ODIyOTQ1ODh9.IV_zXdkf7hELYUpnJDW3QnFENRrqe6uXzJnHyn9XsgE)

 (application/x-xmind)    


[image2023-10-31_14-30-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTg4OTcwYzJhZjRmNTFmOWJlIiwicmVmX2lkIjoiNjczOTY5YTg3MjgyMDZlZmI5MmVmNWM0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4MTg4LCJleHAiOjE3ODIyOTQ1ODh9.PncOBNNWrW8sa242bSn6a3JswVFsUPKUshE1D0KgIeo)

 (image/png)    
