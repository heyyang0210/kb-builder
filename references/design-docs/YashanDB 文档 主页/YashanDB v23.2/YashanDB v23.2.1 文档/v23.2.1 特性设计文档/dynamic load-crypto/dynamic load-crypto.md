Created by 史鑫, last modified on 十二月 19, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#1-overview%E6%A6%82%E8%BF%B0)  

Yashan的一些基础算法实现依赖    [libcrypto.so](http://libcrypto.so)    .1.1库，此库的加载方式之前是动态链接的方式，即：Yashan的服务端进程启动时，需要强制加载到进程的虚拟地址空间中。（进程虚拟/物理地址空间如下所示）

![](https://pingcode.yasdb.com/atlas/files/public/67396c0a8970c2af4f5208d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQ0FBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg3NDksImV4cCI6MTc4MjMwOTU0OX0.H6iSZ2af91IXq8TaRnfq_E4m8sl26IsSnfjMpXZmsGs)

这种强依赖带来的缺点：Yashan强依赖此库；此种强以来，不利于后续库的替换。为去除这种强依赖，要改成动态加载，即Yashan启动阶段不强制加载到内存，自行加载相应符号表。此外，当此库在环境中找不到时，在某些约束下，仍可运行，如不加载，约束如下：

- 不加载可用
    - 密码存储：
        - 普通用户：用户的密码以明文存储在系统表。
        - sys用户：由yaspwd生成的sys密码，以明文存储在密码文件中
    - 密码认证：
        - 认证过程，密码在网络上以明文传输。
- 不加载不可用：
    - SSL：不加载库，则报错。
    - 表空间透明加密
        - 不支持，报错。


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

涉及的工具：

- yaspwd
- yasql


**说明**  ：yasql/yaspwd(密码文件)/yasdb是否加载crypto，要一致才能登录。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#3-interfaces%E6%8E%A5%E5%8F%A3)  

### 配置参数

_CRYPTO_ENABLED

- 重启生效/隐藏参数
- 只有_CRYPTO_ENABLED ==off，才允许加载不到crypto，_CRYPTO_ENABLED ==on，没加载crypto，起库报错
- 建库后不能修改。CTRL->BOOT（YAS-00611 encrypt mode mismatched, expect PLAIN, but actual OPENSSL）


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=107391731#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 加载crypto
    - SSL测试
    - 登录测试
    - yaspwd测试
    - 表空间透明加密测试
- 没加载crypto
    - SSL测试
    - 登录测试
    - yaspwd测试
    - 表空间透明加密测试


##   [7. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=89094607#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

文档上要提示用户怎么做：没加载上的ACTION

## Attachments:

[image2023-12-13_15-5-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMGE4OTcwYzJhZjRmNTIwOGQ1IiwicmVmX2lkIjoiNjczOTZjMGE3MjgyMDZlZmI5MmYwY2RhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NzQ5LCJleHAiOjE3ODIzODUxNDl9.xge3xrFJrJhsQ1-JAhE1abFc4M4Xmaw7xTU9OBxMOTE)

 (image/png)    
