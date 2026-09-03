Created by 刘亮杰, last modified on 五月 15, 2024

# 【python】驱动支持'用户名/密码@IP地址/数据库名‘方式来连接

SR：

  [https://pingcode.yasdb.com/pjm/items/661e7847fd997db58adae9e8](https://pingcode.yasdb.com/pjm/items/661e7847fd997db58adae9e8)    ?    
  #YDBRD-26441 【python】驱动支持'用户名/密码@IP地址/数据库名‘方式来连接

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#1-overview%E6%A6%82%E8%BF%B0)  

需求来源： 

博时基金

需求场景： 

客户提的易用性需求，希望python驱动支持'用户名/密码@IP地址/数据库名‘方式来连接

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

python文档

  [PEP 249 – Python Database API Specification v2.0 | peps.python.org](https://peps.python.org/pep-0249/)  

ORACLE文档

  [1. API: python-oracledb Module — python-oracledb 2.3.0b1 documentation](https://python-oracledb.readthedocs.io/en/latest/api_manual/module.html#oracledb.connect)  

  


通过yaspy模块提供的connect函数建立数据库连接，并返回一个连接对象（Connection）。

可使用方法如下：

```
# 使用dsn、user、password参数
conn = yaspy.connect(dsn=self.getDsn(), user=self.user, password=self.pwd)
# 使用dsn参数
conn = yaspy.connect(self.user+"/"+self.pwd+"@"+self.getDsn())
# 使用dsn、password参数
conn = yaspy.connect(self.user+"@"+self.getDsn(), password=self.pwd)
# 使用host、port、user、password参数
conn = yaspy.connect(host=self.host, port=self.port, user=self.user, password=self.pwd)

```

###   [可选参数](#可选参数)  

|参数|描述|
|---|---|
|dsn|数据源名称（data source name），格式为："user/password@host:port"或"user@host:port"或"host:port"，可包含数据库用户名、密码、IP地址、端口号等信息，选填项。|
|user|数据库用户名，选填项。|
|password|数据库用户密码，选填项。|
|host|数据库IP地址，选填项。|
|port|数据库端口号，默认为1688，选填项。|


如果user和password中有特殊字符/、@、\，需要使用符号\进行转义，举例如下：

|dsn|user|password|host|port|
|---|---|---|---|---|
|127.0.0.1:1688|未指定|未指定|127.0.0.1|1688|
|  [sys@127.0.0.1](mailto:sys@127.0.0.1)    :1688|sys|未指定|127.0.0.1|1688|
|  [sys/yasdb_123@127.0.0.1](mailto:sys/yasdb_123@127.0.0.1)    :1688|sys|yasdb_123|127.0.0.1|1688|
|sys/yasdb\@    [_123@127.0.0.1](mailto:_123@127.0.0.1)    :1688|sys|yasdb@_123|127.0.0.1|1688|
|sys\//yasdb\@    [_123@127.0.0.1](mailto:_123@127.0.0.1)    :1688|sys/|yasdb@_123|127.0.0.1|1688|
|s\/ys\@\\/yasdb\@    [_123@127.0.0.1](mailto:_123@127.0.0.1)    :1688|s/ys@\|yasdb@_123|127.0.0.1|1688|


  


  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
def connect(
        dsn: str = None,
        user: str = None,
        password: str = None,
        *,
        host: str = None,
        port: int = 1688,
        autocommit: bool = False,
) -> YasdbConnection:
```

  


  [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

```
def replace_special_chars(dsn_str):
    special_chars = {
        "\\": "{dsn_placeholder_1}",
        "/": "{dsn_placeholder_2}",
        "@": "{dsn_placeholder_3}"
    }
    escape_char = "\\"
    for k, v in special_chars.items():
        dsn_str = dsn_str.replace(escape_char + k, v)
    return dsn_str


def recovery_special_chars(s):
    special_chars = {
        "\\": "{dsn_placeholder_1}",
        "/": "{dsn_placeholder_2}",
        "@": "{dsn_placeholder_3}"
    }
    for v, k in special_chars.items():
        s = s.replace(k, v)
    return s


def connect(
        dsn: str = None,
        user: str = None,
        password: str = None,
        *,
        host: str = None,
        port: int = 1688,
        autocommit: bool = False,
) -> YasdbConnection:
    conn = YasdbConnection()
    if dsn and "@" in dsn:
        dsn_str = replace_special_chars(dsn)
        dsn_str_parts = dsn_str.split("@")
        dsn_str = dsn_str_parts[1] if len(dsn_str_parts) > 1 else None
        user_pass = dsn_str_parts[0]
        if "/" in user_pass:
            user_pass = user_pass.split("/")
            user_str = user_pass[0]
            pass_str = user_pass[1] if len(user_pass) > 1 else None
            password = recovery_special_chars(pass_str)
        else:
            user_str = user_pass
        user = recovery_special_chars(user_str)
        dsn = dsn_str
    if not dsn:
        dsn = host + ":" + str(port)
    try:
        conn.connect(dsn, user, password, autocommit=autocommit)
    except:
        conn.close()
        raise
    return conn
```

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
def test_dsn_conn_1(self):
        conn = yaspy.connect(self.user+"/"+self.pwd+"@"+self.getDsn())
        self.assertFalse(conn.autocommit)
        del conn

    def test_dsn_conn_2(self):
        conn = yaspy.connect(self.user+"@"+self.getDsn(), password=self.pwd)
        self.assertFalse(conn.autocommit)
        del conn

    def test_dsn_conn_3(self):
        conn = yaspy.connect(self.user + "/" + self.passwd + "@" + self.getDsn())
        self.assertFalse(conn.autocommit)
        cursor = conn.cursor()
        cursor.execute('create user test_pwd_1 identified by "Cod@2022"')
        cursor.execute("grant create session to test_pwd_1")
        cursor.execute("grant create table to test_pwd_1")
        cursor.execute('create user test_pwd_2 identified by "Cod/2022"')
        cursor.execute("grant create session to test_pwd_2")
        cursor.execute("grant create table to test_pwd_2")
        cursor.execute('create user test_pwd_3 identified by "Cod\\2022"')
        cursor.execute("grant create session to test_pwd_3")
        cursor.execute("grant create table to test_pwd_3")
        conn.close()
        del conn
        conn_new_1 = yaspy.connect("test_pwd_1" + "/" + "Cod\\@2022" + "@" + self.getDsn())
        cursor_new_1 = conn_new_1.cursor()
        cursor_new_1.execute("create table test(id int,c1 char(10))")
        cursor_new_1.execute("insert into test values(1,'name')")
        cursor_new_1.execute("select count(*) from test")
        result = cursor_new_1.fetchone()
        self.assertEqual(1, result[0])
        conn_new_1.close()
        del conn_new_1
        conn_new_2 = yaspy.connect("test_pwd_2" + "/" + "Cod\\/2022" + "@" + self.getDsn())
        cursor_new_2 = conn_new_2.cursor()
        cursor_new_2.execute("create table test(id int,c1 char(10))")
        cursor_new_2.execute("insert into test values(1,'name')")
        cursor_new_2.execute("select count(*) from test")
        result = cursor_new_2.fetchone()
        self.assertEqual(1, result[0])
        conn_new_2.close()
        del conn_new_2
        conn_new_3 = yaspy.connect("test_pwd_3" + "/" + "Cod\\\\2022" + "@" + self.getDsn())
        cursor_new_3 = conn_new_3.cursor()
        cursor_new_3.execute("create table test(id int,c1 char(10))")
        cursor_new_3.execute("insert into test values(1,'name')")
        cursor_new_3.execute("select count(*) from test")
        result = cursor_new_3.fetchone()
        self.assertEqual(1, result[0])
        conn_new_3.close()
        del conn_new_3
        conn = yaspy.connect(dsn=self.getDsn(), user=self.user, password=self.passwd)
        cursor = conn.cursor()
        cursor.execute("drop user test_pwd_1 cascade")
        cursor.execute("drop user test_pwd_2 cascade")
        cursor.execute("drop user test_pwd_3 cascade")
        conn.close()
        del conn

    def test_host_conn(self):
        conn = yaspy.connect(host=self.host, port=self.port, user=self.user, password=self.pwd)
        self.assertFalse(conn.autocommit)
        del conn
```

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments:

[image2022-4-10_16-26-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzdhMWFkOWEzMzExZGM5MTRjIiwicmVmX2lkIjoiNjczOTZkNzc3MjgyMDZlZmI5MmYxZjQ1IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NTk1LCJleHAiOjE3ODIzOTQ5OTV9.M62zNoMrVGI-eDyqL8G1ArH1cTFCILeLWJdk1h5OPLU)

 (image/png)    
