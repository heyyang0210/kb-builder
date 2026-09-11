Created by 贺天欢 on 十二月 12, 2023

# SR：    [YDBRD-14490](https://jira.yasdb.com/browse/YDBRD-14490?src=confmacro)    -  userenv函数支持GLOBAL_SESSION_ID  完成

# 1.   **概述**

分布式下，存在一个全局sid的概念，称为global session id, 简称gsid，是一个大于65536的32位值，希望能够在userenv中显示gsid字段，区别于sid。

# 2.   **需求分析**

- 支持用usernev('gsid'); 查询
- 支持作为过滤条件，保持各节点一致。
- 只支持分布式获取正确，非分布式（单机、集群）模式下userenv('gsid')=sid


# 3.   **测试设计方法**

对本测试设计使用的工程方法做说明，如常用的边界值，等价类，流程图及相关的组合策略

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

本次测试采用guider测试框架实现，执行sql文件，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|分布式|


## Attachments:

[文本用例-userenv支持gsid.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTY4OTcwYzJhZjRmNTFmOTNiIiwicmVmX2lkIjoiNjczOTY5OTY3MjgyMDZlZmI5MmVmNGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTczLCJleHAiOjE3ODIyOTM5NzN9.3HebZ9IxoXDQtJBdANKY6ms1lLetQDo0-apvn3svuPk)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[userenv函数支持gsid最终测试点.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTc4OTcwYzJhZjRmNTFmOTNkIiwicmVmX2lkIjoiNjczOTY5OTY3MjgyMDZlZmI5MmVmNGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTczLCJleHAiOjE3ODIyOTM5NzN9.bF3c7BHunE3CwhmSBt2ax2ZiuaHOBjPJLqcV3kyk3VI)

 (application/x-xmind)    


[userenv函数支持gsid-评审后.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTdhMWFkOWEzMzExZGM3N2IzIiwicmVmX2lkIjoiNjczOTY5OTY3MjgyMDZlZmI5MmVmNGNlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTczLCJleHAiOjE3ODIyOTM5NzN9.b5uOHMPBlyB57wk-SFWYyJiQe4VAKUjnci_bnCTlh4Y)

 (application/x-xmind)    
