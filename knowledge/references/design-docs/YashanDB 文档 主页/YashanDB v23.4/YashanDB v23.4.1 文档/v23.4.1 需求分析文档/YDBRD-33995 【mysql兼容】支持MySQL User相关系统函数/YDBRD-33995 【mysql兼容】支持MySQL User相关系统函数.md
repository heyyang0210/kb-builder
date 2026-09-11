Created by 王林, last modified on 十一月 15, 2024

SR:     [https://pingcode.yasdb.com/pjm/items/670a59e4e489dd0868f668d9](https://pingcode.yasdb.com/pjm/items/670a59e4e489dd0868f668d9)    ? #YDBRD-33995 【mysql兼容】支持MySQL User相关系统函数

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#1-%E6%80%BB%E8%BF%B0)  

在原有的mysql框架之上，适配 curent, current()函数、session_user(), system_user()函数。

  


#   [1.1 需求合理性分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#11-%E9%9C%80%E6%B1%82%E5%90%88%E7%90%86%E6%80%A7%E5%88%86%E6%9E%90)  

  


##   [1.2 需求实现分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#12-%E9%9C%80%E6%B1%82%E5%AE%9E%E7%8E%B0%E5%88%86%E6%9E%90)  

  


### 1.2.1 current_user

返回服务器用于对当前客户端进行身份验证的MySQL帐户的用户名和主机名组合。同函数current_user()等价。

函数定义

```
CURRENT_USER
入参： 无
返回值：服务器用于对当前客户端进行身份验证的MySQL帐户的用户名和主机名组合，此帐户决定您的访问权限。返回值varchar类型，最大93字符，utf8字符集。
```

  


### 1.2.2 curent_user()函数

返回服务器用于对当前客户端进行身份验证的MySQL帐户的用户名和主机名组合。

函数定义

```
CURRENT_USER()
入参： 无
返回值：服务器用于对当前客户端进行身份验证的MySQL帐户的用户名和主机名组合，此帐户决定您的访问权限。返回值varchar类型，最大93字符，utf8字符集。
```

  


**函数实现**

```
function_call_keyword:
...
    | CURRENT_USER optional_braces
     {
        $$= NEW_PTN Item_func_current_user(@$);
     }
...
```

从变量 m_priv_user, m_priv_host 获取对应的登录用户名对应的认证用户、认证的主机名。  


**说明**

- create user 时 可以指定主机名或ip 以及 ’%‘,  那么判断用户是否能够登录会去查看mysql.user 系统表对应的缓存内容 find_mpvio_user，若匹配上才可登录。匹配规则如下：若有’%‘ 排在最后匹配，其它的按创建的先后顺序匹配。
- current_user()结果中的用户名不一定是登录时指定的用户名，比如在登录时使用代理用户时，current_user(）函数的返回值中的用户名为代理用户对应的真实用户名。
- 若数据库创建了空的用户名（create user ''@'%' identified by 'Cod-2022'），当用户不存在时进行登录，current_user(）结果中对应的用户名信息为空。




**示例**

```
[wln@vm181 ~]$ mysql -uuser11 -pCod-2022 
mysql> select current_user();
+----------------+
| current_user() |
+----------------+
| @%             |
+----------------+
1 row in set (0.02 sec)


drop user user1@'vm181';
drop user user1@'172.16.60.205';
drop user user1@'%';
 


create user  user1@'vm181' identified by 'test';
create user  user1@'172.16.60.205' identified by 'test';
create user  user1@'%' identified by 'test';

---------- 测试1
create user  user1@'vm181' identified by 'test';
create user  user1@'172.16.60.205' identified by 'test';


> mysql -uuser1 -ptest -h172.16.60.205 

mysql> select current_user();
+----------------+
| current_user() |
+----------------+
| user1@vm181    |
+----------------+
1 row in set (0.02 sec)


 > mysql -uuser1 -ptest -h172.16.60.205
 
 mysql> select current_user();
+----------------+
| current_user() |
+----------------+
| user1@vm181    |
+----------------+
1 row in set (0.02 sec)


---------- 测试2

create user  user1@'172.16.60.205' identified by 'test';
create user  user1@'vm181' identified by 'test';


> mysql -uuser1 -ptest -h172.16.60.205 

mysql> select current_user();
+---------------------+
| current_user()      |
+---------------------+
| user1@172.16.60.205 |
+---------------------+
1 row in set (0.02 sec)


 > mysql -uuser1 -ptest -h172.16.60.205
 

mysql> select current_user();
+---------------------+
| current_user()      |
+---------------------+
| user1@172.16.60.205 |
+---------------------+
1 row in set (0.01 sec)



---------- 测试3
create user  user1@'vm181' identified by 'test';
create user  user1@'172.16.60.205' identified by 'test';
create user  user1@'%' identified by 'test';

> mysql -uuser1 -ptest -h172.16.60.205 

mysql> select current_user();
+----------------+
| current_user() |
+----------------+
| user1@vm181    |
+----------------+
1 row in set (0.01 sec)


 > mysql -uuser1 -ptest -h172.16.60.205
 
 mysql> select current_user();
+----------------+
| current_user() |
+----------------+
| user1@vm181    |
+----------------+
1 row in set (0.01 sec)



 ---------- 测试4

create user  user1@'172.16.60.205' identified by 'test';
create user  user1@'vm181' identified by 'test';
create user  user1@'%' identified by 'test';


> mysql -uuser1 -ptest -h172.16.60.205 

mysql> select current_user();
+---------------------+
| current_user()      |
+---------------------+
| user1@172.16.60.205 |
+---------------------+
1 row in set (0.02 sec)



 > mysql -uuser1 -ptest -h172.16.60.205
 
mysql> select current_user();
+---------------------+
| current_user()      |
+---------------------+
| user1@172.16.60.205 |
+---------------------+
1 row in set (0.02 sec)
```

  


### 1.2.3 session_user() 函数

返回连接服务器使用的用户名和主机名的组合，utf8字符集。和函数user() 是同义词，在语法阶段将session_user识别为user （  { SYM_FN("SESSION_USER",          USER)}  ）。

函数定义

```
SESSION_USER()
入参： 无
返回值：该值表示连接到服务器时指定的用户名，以及连接的客户端主机名的组合。varchar类型，最大93字符, utf8字符集。
```

### 1.2.4 system_user()函数

返回连接服务器使用的用户名和主机名的组合，utf8字符集。

是函数user()的同义词。在语法阶段将session_user识别为 user。  { SYM_FN("SYSTEM_USER",           USER)}。

  


函数定义

```
SYSTEM_USER()
入参： 无
返回值：该值表示连接到服务器时指定的用户名，以及连接的客户端主机名的组合。varchar类型，最大93字符, utf8字符集。
```

### 1.2.5 user()函数

返回连接服务器使用的用户名和主机名的组合，utf8字符集。

  


**函数定义**

```
USER()
入参： 无
返回值：该值表示连接到服务器时指定的用户名，以及连接的客户端主机名的组合。varchar类型，最大93字符, utf8字符集。
```

  


**函数实现**

m_user ， m_host_or_ip 登录时赋值。

问题：登录时指定的-hip 为什么显示的是主机名 ？ 

:: mysql 会根据其ip 去找hostname, 没找到则显示ip, 找到则显示主机名。受服务端/etc/hosts 中主机名和ip 映射影响。

```
[wln@vm181 anchorbase]$ mysql -u root -padmin -h172.16.60.205

mysql> select current_user(), session_user(), system_user(), user();
+----------------+----------------+---------------+------------+
| current_user() | session_user() | system_user() | user()     |
+----------------+----------------+---------------+------------+
| root@%         | root@vm181     | root@vm181    | root@vm181 |
+----------------+----------------+---------------+------------+
1 row in set (0.02 sec)
```

navicat11 登录

```
mysql> select current_user(), session_user(), system_user(), user();
+----------------+---------------------+---------------------+---------------------+
| current_user() | session_user()      | system_user()       | user()              |
+----------------+---------------------+---------------------+---------------------+
| root@%         | root@192.168.137.84 | root@192.168.137.84 | root@192.168.137.84 |
+----------------+---------------------+---------------------+---------------------+
1 row in set
```

  


  


##   [1.3 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#13-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|无|  
|  
|  
|


##   [1.4 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#14-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

#   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#2-%E6%8E%A5%E5%8F%A3)  

  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. Dependency（功能依赖）](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#4-dependency%E5%8A%9F%E8%83%BD%E4%BE%9D%E8%B5%96)  

  


##   [5. 参考](https://conf.yasdb.com/pages/viewpage.action?pageId=91777359#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

MySQL  Reference Manual 中内置函数章节

MySQL 代理用户（  [https://www.modb.pro/db/623961](https://www.modb.pro/db/623961)  ）

  


  


  


  
