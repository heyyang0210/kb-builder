Created by 王仁松, last modified on 一月 04, 2024

https://jira.yasdb.com/browse/YDBRD-21590

# 1. Overview

1. 支持encrypt_aes128加密函数
1. 支持decrypt_aes128解密函数
1. 两个函数使用相同的密钥进行加解密


# 2. Features

1. 对指定类型进行加密操作，返回加密字符串
1. 对加密字符串进行解密，返回解密出的字符串
1. 对称加解密算法


# 3. Interfaces



# 4. Specification And Constraints

- 加密类型：字符串，数字类型，二进制类型中row类型，时间日期中的timestamp，date。
- 加密返回类型：字符串vachar
- 解密类型：字符串varchar
- 解密输出类型：字符串varchar


# 5. Detail Design

## 5.1 加解密

### encrypt_aes128(encryptstr,keystr)

![](https://pingcode.yasdb.com/atlas/files/public/67396bfea1ad9a3311dc86f5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

函数概述： 固定2个输入参数，返回使用keystr的密钥对encryptstr字符串aes128对称加密后的字符串。

输入类型：

- encryptstr：  ~~varchar，char，数值类型，时间日期中的timestamp，date，~~  类型转换规则：    [数据类型转换 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.1/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E8%BD%AC%E6%8D%A2.html)    ，所有支持转varchar的类型，输入null，返回null
- keystr：varchar，不能为null


返回值类型：varchar

示例：

```
SQL> create table t2(id int, c1 varchar(32000));

Succeed.

SQL> insert into t2 values(2, encrypt_aes128('我是中国人ssdawd12315123@@！#%！%！@#！@#！收到就哦啊价格', 'abc'));

1 row affected.

SQL> select * from t2;

          ID C1
------------ ----------------------------------------------------------------
3tzԃ��$RЙ~H2dk�A+f�tйx]�X�&�Px���M���:jPFmH�<

1 row fetched.

SQL> select decrypt_aes128(c1, 'abc') from t2;

DECRYPT_AES128(C1,'A
----------------------------------------------------------------
我是中国人ssdawd12315123@@！#%！%！@#！@#！收到就哦啊价格

1 row fetched.
```

加密流程：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396bfe8970c2af4f520882/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

  


- 对于支持的非字符串加密类型，在Exec阶段做转化字符串进行处理
- key不能为null
- Conclude阶段，由于加密返回类型固定是varchar字符串，因此给固定类型即可


### decrypt_aes128(decryptstr,keystr)

![](https://pingcode.yasdb.com/atlas/files/public/67396bfe8970c2af4f520884/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

函数概述：固定2个输入参数，返回使用keystr的aes128密钥对decrypstr字符串进行对称解密后的字符串。解密使用的keystr密钥必须与加密时使用的keystr密钥相同才可解密出原始的明文。

输入类型：

- decryptstr：varchar，输入null，返回null
- keystr：varchar，不能为null


返回值类型：varchar

示例：

```
SQL> create table t2(id int, c1 varchar(32000));

Succeed.

SQL> insert into t2 values(2, encrypt_aes128('我是中国人ssdawd12315123@@！#%！%！@#！@#！收到就哦啊价格', 'abc'));

1 row affected.

SQL> select * from t2;

          ID C1
------------ ----------------------------------------------------------------
3tzԃ��$RЙ~H2dk�A+f�tйx]�X�&�Px���M���:jPFmH�<

1 row fetched.

SQL> select decrypt_aes128(c1, 'abc') from t2;

DECRYPT_AES128(C1,'A
----------------------------------------------------------------
我是中国人ssdawd12315123@@！#%！%！@#！@#！收到就哦啊价格

1 row fetched.
```

解密流程：

![](https://pingcode.yasdb.com/atlas/files/public/67396bfea1ad9a3311dc86f8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

  


- 解密类型固定为字符串varchar类型
- key不能为null
- Conclude阶段，由于解密返回类型固定是字符串varchar，因此给固定类型即可


## 5.2 加解密算法

使用AES128对称加密算法，anchorbase使用encrEncrypt以及对应接口进行实际的加解密操作。

### AES加密算法

AES是双向对称加密，加密解密使用的密钥为同一个，是目前比较流行的高级加密算法，是DES算法的替代者。AES算法支持不同长度的密钥：128，192，256位等。

填充：AES有多种填充方式， 目前我们默认只使用NO_PADDING方式：

```
typedef enum EnEncrPaddingMode {
    ENCR_NO_PADDING = 0,
    ENCR_PKCS5 = 1,
    ENCR_PKCS7 = 2,
    ENCR_ZEROS_PADDING = 3,
} EncrPaddingMode;
```

模式：AES算法支持多种模式：ECB、CBC、CFB、OFB、CTR等

IV初始化向量：分组加密中，通常需要一个IV，通俗来讲就是干扰项，增强加密安全性。目前我们使用静态常量：

```
static const CodUchar _tdeIv[] = "Y1@#4*Db2-&,.2^b";
```

因此，由于模式以及填充还有IV的多种方式，即使是相同的明文使用相同的密钥进行加密，也可能得出不同的加密结果。所以只需要关注是否能使用相同的密钥加解密操作即可。

## 5.3 列存支持

列存使用通用表达式支持，可以复用行存的逻辑

## 5.4 dml

**需要考虑select into场景和update场景**

**在相应的函数框架下实现对应功能，其余场景自动实现。**

## 5.5 审计安全

**注意：脱敏放在parse之后，对于parse的时候位于敏感信息之前的sql中的位置就报错返回的不会设置脱敏标志位，会记录原sql，有暴露敏感信息风险，这一点oracle也是如此。**

![](https://pingcode.yasdb.com/atlas/files/public/67396bfea1ad9a3311dc86f9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

审计目前有2处地方：

```
alter system set unified_auditing = true;
create audit policy up1 actions all; --  或者actions select 等， all代表所有
audit policy up1;
然后执行 加解密函数，  会写审计记录  （select * from unified_audit_trail;）
```

```
AUDIT_SYS_OPERATIONS 这个参数打开 会写log日志（run.log)
alter system set AUDIT_SYS_OPERATIONS = true;
```

修改方案：

1. 将auditSqlPrepareBegin后移至解析函数doParse之后，在auditSqlPrepareBegin之前任何失败错误都将导致传入强制匹配脱敏flag（isForced），从而避免错误导致提前返回未能做脱敏审计
1. 在AnlStmt的attr上新增一个标志位isDesensit用来标识是否需要做脱敏，在解析的逻辑中遇到对应的解密解密函数会设置isDesensit为true
1. 在审计函数中新增判断isForced是否强制匹配脱以及isDesensit是否正常脱敏
1. 脱敏采用将函数中的所有参数用一个*号替换


实际效果：

在unified_audit_trail视图中，无论sql执行失败还是成功，均将参数脱敏

![](https://pingcode.yasdb.com/atlas/files/public/67396bfe8970c2af4f520885/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

在run.log中，无论sql执行失败还是成功，均将参数脱敏

![](https://pingcode.yasdb.com/atlas/files/public/67396bfe8970c2af4f520886/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

对于子查询以及insert into带有括号()的，会在解析中连同括号中的内容当作一个word，而原先审计的逻辑中没有考虑继续解析括号内的内容的情况，因此需要额外修改：

1. 当遇到括号时， 使用lexPushWord继续解析其内部的内容，记录pushTimes次数
1. 当遇到eof时，额外判断pushTimes是否为0，否则此前有pushWord，则需要popLexr然后继续处理后面的字符串


### 5.5.1 慢日志

慢日志也可以记录sql，由于加密解密函数只是普通的带有密钥安全属性的内置函数，因此可以出现在复杂的sql语句中，此时慢日志中也需要做对应的托脱敏。

修改方案：

在anlRecordSlowlog中持有当前stmt的情况下，复用审计的修改方案，提前将sqltext替换为审计脱敏后的sqltext。

实际效果：

alter system set enable_slow_log = true;    
  alter system set SLOW_LOG_TIME_THRESHOLD = 0;

![](https://pingcode.yasdb.com/atlas/files/public/67396bfe8970c2af4f520887/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

### 5.5.2 其他视图

发散下，发现v$sql以及v$sqlarea视图中在当前连接会话下也会打印sql内容，也需要做对应修改。

修改方案：

1. 在对应类似ftSqlFetch的逻辑中，提前将sqltext替换为审计脱敏后的sqltext，由于此时已经没有历史的stmt了，所以将判断是否脱敏的标志位移动至AnlContext下的attr中与sqltext一起存放。
1. 新增针对视图脱敏的字符替换逻辑


实际效果：

```
SQL> select sql_text from v$sql where sql_text like '%encrypt_aes128%';

SQL_TEXT
----------------------------------------------------------------
select sql_text from v$sql where sql_text like '%encrypt_aes128%'

1 row fetched.

SQL> select encrypt_aes128('123', '1234567') from dual;

ENCRYPT_AES128('123'
--------------------
�

1 row fetched.

SQL> select sql_text from v$sql where sql_text like '%encrypt_aes128%';

SQL_TEXT
----------------------------------------------------------------
select sql_text from v$sql where sql_text like '%encrypt_aes128%'
select encrypt_aes128 (*) from dual

2 rows fetched.
```

23.2 一共目前使用sql_text的地方：

![](https://pingcode.yasdb.com/atlas/files/public/67396bfea1ad9a3311dc86fa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

即v$sql，v$sqlarea，v$sqlstats，v$sqltext。另外doDdRollback中有打日志行为也需要脱敏。

同样的视图也存在子查询等括号跳过的情况，参考上述审计改法。

分布式场景：dv$sql，dv$sqlarea，dv$sqlstats，dv$sqltext。

分布式场景需要额外处理px发送和接受，也就是在dn上也需要同步cn上的标志位，处理函数：srlzAnlContextAttr，dsrlzAnlContextAttr，dsrlzAnlContext。其中需要在dsrlzAnlContext中将对应AnlContextAttr中的标志位赋值给AnlContext中的attr对应标志位，这样在dn上查询视图时才能拿到具体执行sql时的标志位从而进行脱敏。

### 5.5.3 黑匣子

黑匣子在coredump的情况下会打印当前sql，不排除加解密函数混合其他函数的sql语句会有core的情况，于是，黑匣子也需要做脱敏处理。

修改方案：

1. ~~在打印黑匣子的dump信息时，将当前打印的sql进行脱敏后再打印；具体函数为anlDumpHandler。~~
1. 如果包含敏感信息则不打印


实际效果：

![](https://pingcode.yasdb.com/atlas/files/public/67396bfea1ad9a3311dc86fb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE)

  


# 6. Testcases

- 加密解密不同类型的验证
- 明文、key为null的验证
- 加密解密key相同的验证
- 加密解密key不相同的验证
- select into场景
- update场景


# 7. Document

  [华为云数据库GaussDB官方说明文档](https://support.huaweicloud.com/centralized-devg-v2-opengauss/devg_03_0399.html)  

# 8. Workload



# 9. TODO



  


  


  


  


## Attachments:

[image2023-11-9_11-10-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmQ4OTcwYzJhZjRmNTIwODdiIiwicmVmX2lkIjoiNjczOTZiZmQ3MjgyMDZlZmI5MmYwYzYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDE1LCJleHAiOjE3ODIzODQ4MTV9.K2OkmQBYYMVy96AzvsCMZSFscJzH55wCtaAH5oFssa4)

 (image/png)    


[Decrypt.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmRhMWFkOWEzMzExZGM4NmVmIiwicmVmX2lkIjoiNjczOTZiZmQ3MjgyMDZlZmI5MmYwYzYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDE1LCJleHAiOjE3ODIzODQ4MTV9.cfih8n7pKlfAUiIbop7acm6giPaYGc05eHeTjGdDs14)

 (image/png)    


[Encrypt.drawio.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmRhMWFkOWEzMzExZGM4NmYwIiwicmVmX2lkIjoiNjczOTZiZmQ3MjgyMDZlZmI5MmYwYzYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDE1LCJleHAiOjE3ODIzODQ4MTV9.0kHLs4muGe3KDUzpRitSroUbL1bKKxL_hbRnOPhhOCs)

 (image/png)    


[image2023-12-8_17-45-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZmU4OTcwYzJhZjRmNTIwODdmIiwicmVmX2lkIjoiNjczOTZiZmQ3MjgyMDZlZmI5MmYwYzYyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4NDE1LCJleHAiOjE3ODIzODQ4MTV9.b6dHRxCCeSeNWkXnPm4aFvuepmwZiEup-UbtRUbWLJg)

 (image/png)    


## Comments:

|  [](null)  ,11月14日会议纪要：,1. 示例替换（不能用gauss的文档的示例）    
  2. null，空字符串当作null处理    
  3. 设计文档中aes加密算法用的规格补充完整    
  4. 行：单机和集群，列：单机和分布式    
  5. 列现在只支持utf8，不是合法的先报错    
  6. 审计与log中不能出现加密解密的敏感信息比如用户的密钥等    
  7. 组合测试,Posted by wangrensong at 十一月 15, 2023 18:13|
|---|
|  [](null)  ,11月28日会议纪要：,1. 慢日志：已做脱敏
1. 转换类型失败是什么行为：报错
,Posted by wangrensong at 十一月 28, 2023 17:51|
|  [](null)  ,更新脱敏行为注意事项：  **脱敏放在parse之后，对于parse的时候位于敏感信息之前的sql中的位置就报错返回的不会设置脱敏标志位，会记录原sql，有暴露敏感信息风险，这一点oracle也是如此。**,![](https://pingcode.yasdb.com/atlas/files/public/67396bfea1ad9a3311dc86fc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVlBQUFBQVFBZ0FBQUFCQUFBQUFCQUFBQUFBQUFCQVlCQUFCQUFBQUFFQUFnQUFBQUFBQ0FnSUFBQUFBQUFBQUVnQUFBQUFBQUVnQkFBQUFBQUFFQUFBQWdBRUFCQUFBQUFBRUFBQUFBQUFBQUFBUUFBU1FBQ0FBQUVBQUFFQUFBQWdCQ0FnQUFBQUFBQUlKQUFBRUFLQVFBQUFBSXlBQUlBQ0lBUUFBQWdBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg0MTYsImV4cCI6MTc4MjMwOTIxNn0.jEDwSxMJORWTiCuh8oefS9ILvrwEkXLtFXs6LgrWPtE),Posted by wangrensong at 一月 04, 2024 18:47|
