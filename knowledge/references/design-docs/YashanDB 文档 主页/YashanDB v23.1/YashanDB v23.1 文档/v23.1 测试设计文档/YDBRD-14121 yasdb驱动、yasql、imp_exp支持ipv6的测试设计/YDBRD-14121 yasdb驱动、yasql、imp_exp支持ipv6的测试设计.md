Created by 罗爽, last modified on 八月 11, 2023

# 1.   **概述**

IPV6具有一系列优点，  在数据库内部兼容ipv6通信有利于扩展产品应用场景和提升竞争力。

# 2.   **需求分析**

SR：    [YDBRD-14121](https://jira.yasdb.com/browse/YDBRD-14121?src=confmacro)    -  yasdb驱动、yasql、imp/exp支持ipv6  完成

开发设计文档：    [https://conf.yasdb.com/x/BIdGBw](https://conf.yasdb.com/x/BIdGBw)  

本次特性只测试ipv6单播地址，不支持组播地址、任播地址。单播地址如下：

|地址类型|前缀标识|应用场景|备注|等价ipv4|
|---|---|---|---|---|
|链路本地地址|FE80::/10|作用范围只在链路本地同一广播域下，默认自动分配|自动生成（也可手动配置）|  
|
|唯一本地地址|FC00::/7|全局唯一但路由范围限制在私网内部，如公司，需配置|点击查看    [配置方法](https://conf.yasdb.com/pages/viewpage.action?pageId=122063617)  |192.168.x.x|
|环回地址|::1/128|数据包不离开计算机，本机收发|  
|127.0.0.1|
|全球单播地址|  
|带有全球单播前缀的IPv6地址，其作用类似于IPv4中的公网地址|需要分配|  
|
|所有地址|::|监听时能监听任何地址|  
|0.0.0.0|


**测试范围：**

- yasdb驱动：JDBC、ODBC、Python驱动
- yasql
- imp/exp
- 客户端覆盖：Windows、linux


       注意：驱动连接  **需要先alter database open才能成功连接。**

# 3.   **测试设计方法**

测试设计主要采用等价类及错误推测等测试法进行设计。

|监听地址|url有效等价类|url无效等价类|
|---|---|---|
|[::]:1688 所有地址|[::]:1688 -本机|本机发起的错误ipv6地址|
|  
|[::1]:1688 -本机|  
|
|  
|[link_local]:1688 -本机/它机|  
|
|  
|[link_global]:1688 -本机/它机|  
|
|  
|ipv4嵌入ipv6地址 -本机  /它机|  
|
|  
|ipv4:1688 -本机/它机|  
|
|[::1]:1688|[::]:1688 -本机|[link_local]:1688 -本机|
|  
|[::1]:1688 -本机|[link_global]:1688 -本机|
|  
|  
|ipv4嵌入ipv6地址 -本机|
|  
|  
|ipv4:1688 -本机|
|  
|  
|本机发起的错误ipv6地址|
|  
|  
|它机发起的连接|
|[link_local]:1688|  
|[::]:1688 -本机|
|  
|[link_local]:1688 -本机|[::1]:1688 -本机|
|  
|[link_local]:1688 -它机|[link_global]:1688 -本机|
|  
|  
|ipv4嵌入ipv6地址 -本机|
|  
|  
|ipv4:1688 -本机|
|  
|  
|没标志网络接口号的本机连接|
|  
|  
|它机发起的非  link_local  连接|
|  
|  
|本机发起的错误ipv6地址|
|[link_global]:1688|  
|[::]:1688 -本机    
|
|  
|[link_global]:1688 -本机|[::1]:1688 -本机|
|  
|[link_global]:1688 -它机|[link_local]:1688 -本机|
|  
|  
|ipv4嵌入ipv6地址 -本机|
|  
|  
|ipv4:1688 -本机|
|  
|  
|它机发起的非  link_global  连接|
|  
|  
|本机发起的错误ipv6地址|
|[::FFFF:ipv4]:1688/    
  [0000:0000:0000:0000:0000:FFFF:ipv4]:1688|  
|[::]:1688 -本机    
  [::1]:1688 -本机    
|
|  
|[::FFFF:ipv4]:1688/  -本机    
  [0000:0000:0000:0000:0000:FFFF:ipv4]:1688|[link_local]:1688 -本机|
|  
|ipv4:1688  -本机|[link_global]:1688 -本机|
|  
| [::FFFF:ipv4]:1688/  -它机    
  [0000:0000:0000:0000:0000:FFFF:ipv4]:1688|本机发起的错误ipv6地址|
|  
|ipv4:1688  -它机|它机发起的其他连接|


# 4.   **详细测试设计**

[驱动和工具支持ipv6.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTRhMWFkOWEzMzExZGM3N2EyIiwicmVmX2lkIjoiNjczOTY5OTM3MjgyMDZlZmI5MmVmNDllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzU4LCJleHAiOjE3ODIyOTM3NTh9.4bgvpxzXaTD7HyRWpyTQQN4Z9ZsznTI3wzZjwpX9BaM)

梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|:---|:---|
|并发|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR/testkill|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|否|


# 5.   **测试用例**

测试设计细化后的文本用例。

# 6.   **测试框架设计**

自动化用例添加到YAT框架

# 7.   **测试环境说明**

  


  


  


  


## Attachments:

[驱动和工具支持ipv6.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTRhMWFkOWEzMzExZGM3N2EzIiwicmVmX2lkIjoiNjczOTY5OTM3MjgyMDZlZmI5MmVmNDllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzU4LCJleHAiOjE3ODIyOTM3NTh9.cwZmhlpbDAGpmPW1Xw1bz8yrt_X3HAZOlA-iVysQdwY)

 (application/x-xmind)    


[驱动和工具支持ipv6.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTRhMWFkOWEzMzExZGM3N2EyIiwicmVmX2lkIjoiNjczOTY5OTM3MjgyMDZlZmI5MmVmNDllIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3MzU4LCJleHAiOjE3ODIyOTM3NTh9.4bgvpxzXaTD7HyRWpyTQQN4Z9ZsznTI3wzZjwpX9BaM)

 (application/x-xmind)    
