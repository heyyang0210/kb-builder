Created by 史鑫, last modified on 十月 18, 2024

sr：     [https://pingcode.yasdb.com/pjm/items/6618e207fd997db58ad822af](https://pingcode.yasdb.com/pjm/items/6618e207fd997db58ad822af)    ? #YDBRD-26161 支持MySQL用户登录协议

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

mysql兼容模式下，创建的用户，yashan和mysql都要能进行密码认证（实际认证不是lsnr做，下图做了简化，详情参照：    [server/conn课程 - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=124262525)    ）。

![](https://pingcode.yasdb.com/atlas/files/public/67396ea7a1ad9a3311dc9884/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBSUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBRUFBQkFBQUFRQUFBQWdBQUFCZ0FBQUlRQUFBRUFBQWdBQUNBQkFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQVFBQUFBQUFCQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3MjUsImV4cCI6MTc4MjQ0OTUyNX0.Yqt2iB1LzCnYLSaYJo25pTD-ZxxlXo0WYg3pSOSOKBs)

  


#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

1.插件仅支持 sha256    `_password（5.7的默认版本）`  

2.语法：全是yashan语法。

3.yaspwd支持nomount登录。仅支持sys用户（等价于mysql的root用户？mysql的root不做适配）

4.配置参数新增：

|param|意义|scope|
|---|---|---|
|RSA_PUBLIC_FILE|公钥文件路径|only spfile|
|RSA_PRIVITE_FILE|私钥文件路径|only spfile|


#   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

1.用户所有相关的语法，不做适配，全部继承yashan的。

2.所有的密码，不做版本新增。yashan/mysql创建的用户密码，对方都可使用。

#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

### 密码存储格式

- mysql在服务端能解出明文密码，  **密码存储不做任何变更**  。（yashan做密码相关时，协议/存储的密码解耦，派上用场了）


### 协议交互（认证）：

![](https://pingcode.yasdb.com/atlas/files/public/67396ea7a1ad9a3311dc9885/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBSUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBRUFBQkFBQUFRQUFBQWdBQUFCZ0FBQUlRQUFBRUFBQWdBQUNBQkFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQVFBQUFBQUFCQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3MjUsImV4cCI6MTc4MjQ0OTUyNX0.Yqt2iB1LzCnYLSaYJo25pTD-ZxxlXo0WYg3pSOSOKBs)

#### 协议格式：

#### handshake

![](https://pingcode.yasdb.com/atlas/files/public/67396ea78970c2af4f521a12/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBSUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBRUFBQkFBQUFRQUFBQWdBQUFCZ0FBQUlRQUFBRUFBQWdBQUNBQkFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQVFBQUFBQUFCQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3MjUsImV4cCI6MTc4MjQ0OTUyNX0.Yqt2iB1LzCnYLSaYJo25pTD-ZxxlXo0WYg3pSOSOKBs)

#### handshake response

![](https://pingcode.yasdb.com/atlas/files/public/67396ea78970c2af4f521a13/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBSUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBRUFBQkFBQUFRQUFBQWdBQUFCZ0FBQUlRQUFBRUFBQWdBQUNBQkFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQVFBQUFBQUFCQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3MjUsImV4cCI6MTc4MjQ0OTUyNX0.Yqt2iB1LzCnYLSaYJo25pTD-ZxxlXo0WYg3pSOSOKBs)

#### 默认插件 == 用户插件（sha256） 默认插件 ！= 用户插件（sha256）对比

- 我们用sha256，因为此算法能跟yashan完美兼容。
- mysql的插件类型有两个级别配置：用户/全局，第一次都是用全局方式，user跟全局不一样，存在二次认证流程。
- 全局/user插件类型 异同的差异点：
    - 协议：集中在handshake/handshake response，如上图所示
    - 客户端行为：如果用户/全局不一样，客户端会多计算一次全局的
- **为防止客户端会多计算一次全局插件，我们采用 全局 == 用户 == sha256的方式**


|算法|handshake|handshake response|
|---|---|---|
|#### 第一次使用（sha256）|- capabilities & CLIENT_PLUGIN_AUTH !=0
- auth_plugin_data_len = 15
- auth_plugin_name = sha256_password
|- auth_response_length = 0
- auth_response 无
- capabilities & CLIENT_PLUGIN_AUTH ！=0
- client_plugin_name = sha256_password
|
|#### 第一次使用默认（sha1）|- capabilities & CLIENT_PLUGIN_AUTH ==0
- auth_plugin_data_len = 0
- auth_plugin_name 无
|- auth_response_length = 加密结果长度
- auth_response 加密结果
- capabilities & CLIENT_PLUGIN_AUTH ==0
- client_plugin_name 无
|


  


#### 附录（sha1）：

![](https://pingcode.yasdb.com/atlas/files/public/67396ea78970c2af4f521a15/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiUUFBQUFBQUFBSUFnQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQVFBQUFBQUFBSUFBQUFBQUFBQUFBRUFBQkFBQUFRQUFBQWdBQUFCZ0FBQUlRQUFBRUFBQWdBQUNBQkFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQVFBQUFBQUFCQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFnPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg3MjUsImV4cCI6MTc4MjQ0OTUyNX0.Yqt2iB1LzCnYLSaYJo25pTD-ZxxlXo0WYg3pSOSOKBs)

  


  


# 5.兼容性

### mysql的协议

基线是：mysql的10版本 #define PROTOCOL_VERSION 10

### yashan升级

不涉及

#   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

功能完善

|分类|能力|子功能|  
|
|---|---|---|---|
|能力|密码插件完善|- create user/auth 能力增强
    -   [8.4.1.1 本机可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/native-pluggable-authentication.html)  
    -   [8.4.1.2 缓存 SHA-2 ](https://dev.mysql.com/doc/refman/8.4/en/caching-sha2-pluggable-authentication.html)      [可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/caching-sha2-pluggable-authentication.html)  
    -   [8.4.1.3 SHA-256 可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/sha256-pluggable-authentication.html)  
    -   [8.4.1.4 客户端明文可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/cleartext-pluggable-authentication.html)  
    -   [8.4.1.5 PAM 可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/pam-pluggable-authentication.html)  
    -   [8.4.1.6 Windows 可插入身份验证](https://dev.mysql.com/doc/refman/8.4/en/windows-pluggable-authentication.html)  
    -   [8.4.1.7 LDAP可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/ldap-pluggable-authentication.html)  
    -   [8.4.1.8 Kerberos 可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/kerberos-pluggable-authentication.html)  
    -   [8.4.1.9 免登录可插入身份验证](https://dev.mysql.com/doc/refman/8.4/en/no-login-pluggable-authentication.html)  
    -   [8.4.1.10 套接字对等凭据可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/socket-pluggable-authentication.html)  
    -   [8.4.1.11 WebAuthn 可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/webauthn-pluggable-authentication.html)  
    -   [8.4.1.12 测试可插拔身份验证](https://dev.mysql.com/doc/refman/8.4/en/test-pluggable-authentication.html)  
    -   [8.4.1.13 可插入身份验证系统变量](https://dev.mysql.com/doc/refman/8.4/en/pluggable-authentication-system-variables.html)  
|  
|
||用户属性|- profile:
    - 资源限制
    - 密码策略
,  
|  
|
|语法|create/alter user,  
|create user,- role指定
- 资源/密码策略
|  
|


#   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

# 8.自测用例

```
--sys密码失败
D:\mysql\install\mysql-5.7.42\brelease\client\Debug>mysql -h 127.0.0.1 -P 1279 -u sys -p sys
Enter password: ***
ERROR 2143 (HY000): YAS-02143 invalid username/password, login denied


--sys密码成功
D:\mysql\install\mysql-5.7.42\brelease\client\Debug>mysql -h 127.0.0.1 -P 1279 -u sys -p sys
Enter password: ********
Welcome to the MySQL monitor. Commands end with ; or \g.
Your MySQL connection id is 0
Server version: 5.7.42 Enterprise Edition Debug 23.3.0.2 AMD64

Copyright (c) 2000, 2023, Oracle and/or its affiliates.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql>

--客户端的rsa来自本地/server发送
```

自测bug汇总：

```
问题1：
--mysql登录mysql用户：密码1，正确错误密码都试下
mysql -h 127.0.0.1 -P 1279 -u my_user1 -p my_user1
create table my_user1_t1(id int);
上述parse时，table的owner有误。
分析：ankHanlder上的用户名（text-》buf）的内存来自外部（yashan来自session或UserDict)，此内存不能复用，parse时object owner会使用此内存
ankLoginNoDigestByName --handler的用户名内存来源 全局的UserDict（DC内存参照https://conf.yasdb.com/display/~shixin/dict）,之前mysql用这个接口，没问题
ankLogin  --handler的用户名内存来源  外部。  mysql现在做密码认证了，需要mysql的 用户级别前台信息提供此内存。
解决方式：我先放在YsmyWorker上，飞哥mysql的session的需求合入后，我在腾到mysql_session上。（现阶段mysql的用户前台信息worker--anlHanlder，中间还没session信息）其实用户名是属于session的概念。worker只负责运行资源，不管业务信息
```

## Attachments:

[image2024-6-7_14-16-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTY4OTcwYzJhZjRmNTIxYTA0IiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.i1ACeIWnd5EsnLQ1H6S1Rx-POGwVijlaDseFlNCsKh4)

 (image/png)    


[image2024-6-7_16-28-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTZhMWFkOWEzMzExZGM5ODc5IiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.-HmSTpKTZydo1T_ZTwuBspeE-tvzrI91XwG9TLbFfX4)

 (image/png)    


[image2024-6-7_17-59-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTdhMWFkOWEzMzExZGM5ODdjIiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.VZdmG7L4SVJnnOSQIQr0mwzWYl8edRElhs3fIzXbO8s)

 (image/png)    


[image2024-6-7_17-59-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTdhMWFkOWEzMzExZGM5ODdkIiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.DRH3K7EhnH3XJ44Z_XNLUEyo_ZNYq4phjWoUwERegxY)

 (image/png)    


[image2024-6-19_16-13-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTc4OTcwYzJhZjRmNTIxYTBkIiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.9jxDk7xy-V_gDLV9shuCtx5WHrH4I_PyeALjbhJCL5s)

 (image/png)    


[image2024-6-19_16-25-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTdhMWFkOWEzMzExZGM5ODgxIiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.IV9pL9EWZ8y5DgzSvZKhjGic_8XappiBhdMcn4ntHAI)

 (image/png)    


[image2024-6-19_16-27-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYTdhMWFkOWEzMzExZGM5ODgzIiwicmVmX2lkIjoiNjczOTZlYTY3MjgyMDZlZmI5MmYyYTUyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4NzI0LCJleHAiOjE3ODI1MjUxMjR9.CsgLVOwcV6YHEJyrwulNW6SA_ckqevkFPGJID68hLh8)

 (image/png)    


## Comments:

|  [](null)  ,1.默认sha256？,Posted by shixin at 六月 07, 2024 18:35|
|---|
