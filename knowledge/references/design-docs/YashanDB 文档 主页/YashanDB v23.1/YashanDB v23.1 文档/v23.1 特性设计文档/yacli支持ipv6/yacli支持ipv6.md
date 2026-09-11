Created by 刘亮杰, last modified on 七月 25, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

1. IPV6地址空间数量巨大，支持自动编址，更加安全和高效，在数据库内部兼容ipv6通信有利于扩展产品应用场景和提升竞争力。
1. IPv6地址总长度为128比特，通常分为8组，每组为4个十六进制数的形式，每组十六进制数间用冒号分隔。例如：FC00:0000:130F:0000:0000:09C0:876A:130B，这是IPv6地址的首选格式。
1. 为了书写方便，IPv6还提供了压缩格式，以上述IPv6地址为例，具体压缩规则为：
    1. 每组中的前导“0”都可以省略，所以上述地址可写为：FC00:0:130F:0:0:9C0:876A:130B。
    1. 地址中包含的连续两个或多个均为0的组，可以用双冒号“::”来代替，所以上述地址又可以进一步简写为：FC00:0:130F::9C0:876A:130B。
1. 为了实现IPv4-IPv6互通，IPv4地址会嵌入IPv6地址中：
    1. 此时地址常表示为：X:X:X:X:X:X:d.d.d.d，前96b采用冒分十六进制表示，而最后32b地址则使用IPv4的点分十进制表示。例如::FFFF:192.168.0.1就是一个典型的例子。
    1. 此处压缩0位的方法依旧适用 。
1. 一个IPv6地址可以分为如下两部分：
    1. 网络前缀：n比特，相当于IPv4地址中的网络ID
    1. 接口标识：128-n比特，相当于IPv4地址中的主机ID
1. ipv6地址中的  *单播地址：*


|地址类型|前缀标识|应用场景|备注|
|---|---|---|---|
|链路本地地址|FE80::/10|作用范围只在链路本地同一广播域下，默认自动分配|自动生成（也可手动配置）|
|唯一本地地址|FC00::/7|全局唯一但路由范围限制在私网内部，如公司，需配置|需要it部门分配地址|
|环回地址|::1/128|数据包不离开计算机，本机收发|  
|
|全球单播地址|  
|带有全球单播前缀的IPv6地址，其作用类似于IPv4中的公网地址|需要分配|


考虑到数据库的具体应用场景和测试条件，组播地址、任播地址不在本方案的讨论之内。

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

**一、调研**

1. oracle中，建立连接首先要配置监听和连接。在listener.ora和tnsnames.ora中配置ipv6地址和端口号，它不是采用url格式，因此无需加括号。    [rfc2732文档](http://rfc2cn.com/rfc2732.html)     ；    [oracle文档](https://docs.oracle.com/en/database/oracle/oracle-database/21/netag/understanding-communication-layers.html#GUID-3A7284E5-29C3-4E5F-B934-18D2759308C0)  
1. oracle中支持链路本地地址、唯一本地地址、环回地址、全球单播地址，也支持IPv4地址嵌入IPv6地址。  （    [oracle ipv4-mapped](https://docs.oracle.com/en/database/oracle/oracle-database/21/netag/understanding-communication-layers.html#GUID-DD430684-03D3-4D4D-B678-8BCF37F20514)    ）地址类型如下： 
    1. 环回地址
        1. 与ipv4中的127.0.0.1/8类似，用于主机向自身收发数据包
        1. 在数据库的开发部署测试中应用广泛
    1. L    [ink-Local Address链路本地地址](https://blog.csdn.net/Johan_Joe_King/article/details/105564841)  
        1. 作用范围只在链路本地，即在同一个广播域下的所有设备，相互连接的线路就叫做链路本地，  这类主机通常不需要外部互联网服务，仅有主机间相互通讯的需求  。
        1. 需要标识出网络接口号，因此需要额外的处理，如fe80::d5a0:6043:483c:4bfd  **%ens33**  。不加接口号会导致“invalid arguement"错误。
        1. 未经路由器配置的主机在开启ipv6服务后只有link-local链路本地地址。
    1.   [Unique-Local Unicast Address唯一本地地址](https://developer.aliyun.com/article/102537)  
        1. 全局唯一但不被路由到Internet上，应用于企业站点内部或限制在某些网络内部，类似192.168。
        1. 唯一本地IPv6地址必须通过在路由器上配置本地前缀（路由器宣告RA消息）或者通过DHCPv6的方式进行配置。
    1. 全球单播地址
        1. 地址是全球唯一的，可以在公网使用、全网可路由，类似于 IPv4 的公网 IP 地址。
        1. 地址由 Internet 地址授权委员会（ IANA ）分配给地区 Internet 注册机构（ RIR ），再由 RIR 分配给 Internet 服务提供商（ ISP ）。


### 二、连接yasdb

yasql中配置监听采用url格式，格式为" [ ipv6字符串 ] : 端口号 "，中括号是必须的。

1. **链路本地地址，示例：**
1.     - **yasql sys/sys@[fe80::d5a0:6043:483c:4bfd%ens33]:1688 **

1. **环回地址，示例：**
1.     - **yasql sys/sys@[::1]:1688**

1. **唯一本地地址、全球单播地址，示例：**
1.     - **yasql sys/sys@[fd15:4ba5:5a2b:1008:e05b:a857:fd34:4ea4]:1688**



##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

yasql暂不支持内嵌IPv4地址表示法（    [oracle ipv4-mapped](https://docs.oracle.com/en/database/oracle/oracle-database/21/netag/understanding-communication-layers.html#GUID-DD430684-03D3-4D4D-B678-8BCF37F20514)    ）。是否要增加支持

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

1.  ani_tcp.c文件内增加对link-local的处理函数tcpIpv6LinkLocal
    1. 函数流程
        1. 判断该ipv6地址有无%，无则返回success，有则继续处理
        1. 判断该ipv6地址前缀是否为"fe80"，否则返回error，因为 link local地址一定带有该前缀
        1. 裁剪host中的网络接口号，并调用if_nametoindex将接口号转为区域号并给scopeid赋值
    1. 系统调用
        1. if_nametoindex：在<net/if.h>中声明，输入字符串类型的网络接口号，输出uint32的区域号
1. 对ipv6地址合法性的校验
    1. 修改codIsValidIPV6函数，增加对'%'的判断和处理


  


```
CodResult tcpIpv6LinkLocal(CodChar* host, CodUint32* scopeid)&nbsp;
1. 函数意义
	对ipv6地址族中特定的link-local地址做处理
2. 输入参数
	host：指向待处理的ipv6地址，如"fe80::d5a0:6043:483c:4bfd%ens192"
	scopeid：待赋值的区域号
```

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|监听地址|端口号|状态|备注|
|:---:|:---:|:---:|:---:|
|[::]|1688|[ERROR]: create black box folder failed, error code: 318, error message: failed to create directory /blackbox/20230724_082907, errno 13, error message "Permission denied", location: (ani_file.c:946)|监听地址可能暂不支持[::]|
|[::1]|1688|正常|  
|
|[::1]|1|Starting instance nomount    
  failed to create listener, host: ::1:1    
  YAS-00402 failed to bind socket, errno 13, error message "Permission denied"    
  Failed to start instance|可能端口被占用|
|[::1]|0|正常|  
    
|
|[::1]|65535|正常||
|[::1]|65536|正常，address [::1]:65536 is an invalid URL/Ip address/hostname    
  Failed to start instance|端口号范围0~65535|
|fe80::8603:a001:4cfe:5c1f|1688|YAS-00402 failed to bind socket, errno 22, error message "Invalid argument"    
  Failed to start instance|link-local地址应加网卡号|
|fe80::8603:a001:4cfe:5c1f%ens33|1688|正常||
|[::FFFF:192.0.2.38]|1688|address [::FFFF:192.0.2.38]:1688 is an invalid URL/Ip address/hostname|目前不支持|


##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

|序号|任务（AR）|优先级|关联AR|描述|工作量|责任人|状态|
|:---|:---|:---|:---|:---|:---|:---|:---|
|1|  
|  
|  
|  
|  
|  
|  
|
|2|  
|  
|  
|  
|  
|  
|  
|


##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


  


  


## Attachments:

[image2023-7-20_14-51-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjZiIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.fvulY9-IIRhPpDAKmbruyMga5sC5d5yQOsPrwAdIxBE)

 (image/png)    


[image2023-7-20_14-8-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGUzIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.-GPdb76pE8azc5hqbIJ2WJ3aaKEbKyI02aRyniL9whE)

 (image/png)    


[image2023-7-20_12-55-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjZjIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.qtVRCOtKF_-39gUD0zM1ggVgkNfbbuaAoWQ7O-yz6Mk)

 (image/png)    


[image2023-7-19_20-3-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGU0IiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.7So-31qbdTQE4KC5hYuT44KLXhfluZnT9L9qsOrRwQg)

 (image/png)    


[image2023-7-19_20-1-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGU1IiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.CsO6S9rcBHIVwPLnNTYqRNzV4cJ-qkOVotY9JVLG0lM)

 (image/png)    


[image2023-7-19_10-17-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjZkIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.T_3SrbFRSukqoyY3G-FnvxqrwuVNFWvZYIjguriu2v4)

 (image/png)    


[image2023-7-18_20-18-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGU2IiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.gfMZZKEplJaQtOnDactyNoiWgRdcsMnLe8sjMLq3L34)

 (image/png)    


[image2023-7-18_17-25-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjZlIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.tn1Fd5kLt5g9qMznN9Oum52ZOsY0UTg-W86oQ4lxPKE)

 (image/png)    


[image2023-7-18_16-1-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjZmIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.s63Dw2DrnUieAhjdtEnt-zOoXS-DYvWFMggD5lqmnmc)

 (image/png)    


[image2023-7-17_19-42-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGU3IiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.QuvKsmYXv7ZGRkbhdZ7buP9k0_SVmK1B_ynJ_L5PuC4)

 (image/png)    


[image2023-7-17_19-17-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGU4IiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.WPRNE6J3FStlNutaDZkuQsblZnji9JM2b3o-vlOSkZQ)

 (image/png)    


[image2023-7-17_16-13-41.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjcwIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.QbgInqRp3JkUGI2M8I9j8cFmzr25R7ZY9hs92Byrnds)

 (image/png)    


[image2023-7-17_16-13-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDFhMWFkOWEzMzExZGM3ZGU5IiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.eW0CVZTobUmylFxNUm1NINTtX27YuF_FZuJOTq-S2m4)

 (image/png)    


[image2023-7-17_15-51-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDE4OTcwYzJhZjRmNTFmZjcxIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.YIhM6b6VWYNkTszhplwIcMpveDw8Ekr4LB8u0CRLxEU)

 (image/png)    


[image2023-7-17_15-34-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZDI4OTcwYzJhZjRmNTFmZjcyIiwicmVmX2lkIjoiNjczOTZhZDE3MjgyMDZlZmI5MmVmZWE5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEzMDE3LCJleHAiOjE3ODIyOTk0MTd9.uLFXy8Evv3EpKQFF8l_Oq6a5qNgpGTO8_IjVQLyiaGo)

 (image/png)    
