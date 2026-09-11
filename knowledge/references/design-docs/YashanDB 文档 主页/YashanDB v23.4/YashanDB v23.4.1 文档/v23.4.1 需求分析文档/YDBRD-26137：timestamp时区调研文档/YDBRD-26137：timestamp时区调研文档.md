Created by 徐伟 on 十一月 12, 2024

### 1、时区类型：

|类型|配置参数|默认格式符|精度p|底层存储|取值范围|存储+输出|配置参数修改规则|
|---|---|---|---|---|---|---|---|
|timestamp[p] with time zone|nls_timestamp_tz_format|DD-MON-RR HH.MI.SSXFF AM TZH:TZM|默认6，范围0~9|13bytes(多的2bytes用来存储时区信息）|同timestamp|0、不能作为主键, 建普通索引后内部转成函数索引sys_extract_utc(COL);,1、会存储时区跟值,2、插入是什么内容时，会直接将值存入，不写时区时默认使用session时区来填充插入,3、当设置的nls_timestamp_tz_format不带TZH跟TZM时，输入的字符串在存入时也会使用session时区来填充,4、输出时将值跟时区按sessionFormat输出即可,5、转成timestamp时直接将值copy，不用管时区；,转成ts ltz时，ltz结果为= tz值 + （session时区 - tz时区）,6、做运算时，直接使用值来做运算，不管时区,7、  比较规则？|1、非时区format的匹配规则与之前一致,2  （不做）  、如果设置为TZR时，可以输入'+9:00'来匹配，如果输入,'+09','10','+900'这种无法跟TZH:TZM格式保持匹配时，oracle会容错，然后用当前session时区来填充  （不建议保持一致？）,3  （不做）  、设置为TZR时，如果是输入‘+9:100’oracle会报错，输入‘+9:100aa’oracle会容错使用session时区  （不建议保持一致？），显示按TZH:TZM,4  （按严格匹配，先校验长度，再转换）  、如果设置为TZH或TZM单个时，不允许输入Asion/Shanghai这种TZR匹配，且如果字符串长度超过2会报错，如设置为TZH，输入‘+009’报错  (跟time_zone规则不一致，需保持一致? 定一个规则)，  且缺省的会使用,使用session时区来填充,5、设置为TZH:TZM或TZR时，TZR，TZH跟TZM匹配的字符串可以缺省，会使用session时区填充|
|timestamp[p] with local time zone|nls_timestamp_format|与timestamp复用同一个格式，表示形式也一致|默认6，范围0~9|11bytes|同timestamp|1、只存值，不存时区,2、存的时候会根据session的时区与db时区做一个运算来存入最终值。,存以db时区为准（不能以UTC，虽然以utc为准不会导致运算结果出现错误，但是如果有tzltz时就不能alter database的时区信息，说明存的时候是按dbtz来存）,取以及做任何操作都以sess时区对饮值为准,如：当dbTz='8:00', sessTz='9:00';,此时往该列插入‘2012-1-1 14:10:10’,则存的时候会存成‘2012-1-1 13:10:10’,显示的时候，会将值转成以sessTz为准做显示,3、因此如果有ltz存在的时候，不允许修改数据库时区,4、转成别的类型时，由于都是以session时区为准，所以转timestamp时以session时区算的结果直接复制,转ts tz是以session时区算的结果 + session时区信息,5、做任何运算时也都会先转成以session时区为准的数值|1、跟timestamp保持一致即可|


  


**· 分区键：**

**1、timestamp with time zone不支持作为分区键**

![](https://pingcode.yasdb.com/atlas/files/public/67396eeba1ad9a3311dc9acf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFHQUJBQkFBQUJBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFJSUFBQUlBQUlJQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNzIsImV4cCI6MTc4MjQ2NTg3Mn0.WGARSrqoWTwXpv1hPaTbwIArvDjPp3_NKaKi99Jab_I)

![](https://pingcode.yasdb.com/atlas/files/public/67396eeb8970c2af4f521c5d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFHQUJBQkFBQUJBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFJSUFBQUlBQUlJQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNzIsImV4cCI6MTc4MjQ2NTg3Mn0.WGARSrqoWTwXpv1hPaTbwIArvDjPp3_NKaKi99Jab_I)

**2、timestamp with local time zone作为分区键时（range，list），**  **分区值必须是**  **to_timestamp_tz('XXX'), 其余以timestamp‘’， to_timestamp()均不行，**  **或者是**  **MAXVALUE，DEFAULT**

![](https://pingcode.yasdb.com/atlas/files/public/67396eeb8970c2af4f521c5e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFHQUJBQkFBQUJBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFJSUFBQUlBQUlJQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNzIsImV4cCI6MTc4MjQ2NTg3Mn0.WGARSrqoWTwXpv1hPaTbwIArvDjPp3_NKaKi99Jab_I)

![](https://pingcode.yasdb.com/atlas/files/public/67396eeba1ad9a3311dc9ad0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFHQUJBQkFBQUJBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFJSUFBQUlBQUlJQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNzIsImV4cCI6MTc4MjQ2NTg3Mn0.WGARSrqoWTwXpv1hPaTbwIArvDjPp3_NKaKi99Jab_I)

  


**· 验证localTz，Tz类型在索引、join、复杂表达式表现**  **：**

**结论：**

**1、localTz存储的时候以dbtimezone为基准的时间进行存储**

**2、localTz在取数据时，会先转成session为准的时间。其余类型隐式转换成localTz时也会转成session时间**

**3、tz的数据类型优先级高于localTz， localTz高于timestamp**

**4、tz数据类型在做任何运算，filter时**

  


  


### 2、时区文件：  （不做）

Oracle 将支持的时区信息，比如时区名，时区缩写名都保存在文件中。文件的默认存储 路径为$ORACLE_HOME/oracore/zoneinfo/ 及其子路径中(big和little). 这些路径中中的同名文件，其实是一样的。都是二进制文件，但是从文件大小来看，可以判断，同名文件 虽然在不同的路径中，但是文件内容是一样的。

文件的内容,在数据库启动时，会自动加载，并呈现在视图"V$TIMEZONE_FILE" 中,告知我 们, 数据库现在使用的是哪个文件。

文件分为两种类型：timezlrg_version.dat和timezone_version.dat .

  


### 3、建库级跟session级的time_zone

|级别|设置方式|默认值|查询方式|约束|格式匹配规则|
|---|---|---|---|---|---|
|建库级|建库：create database db set time_zone = 'Asia/Shanghai';,或者建库后：alter database set time_zone ='+8:00'(重启后生效）  （不做）|建库时如果没指定则在建库时刻根据操作系统时间来获得时区|select dbtimezone from dual;|- dbtimezone创建数据库时设置或者通过alter database修改，修改时不能存在  tsltz  类型数据，不然会报错。
- ![](https://conf.yasdb.com/download/attachments/171061840/image2024-10-17_10-13-52.png?version=1&modificationDate=1729131233000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUJBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUlBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFHQUJBQkFBQUJBQUFFQUFBQUFJQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFnQUFBQUFBQUFJSUFBQUlBQUlJQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTUwNzIsImV4cCI6MTc4MjQ2NTg3Mn0.WGARSrqoWTwXpv1hPaTbwIArvDjPp3_NKaKi99Jab_I)
- dbtimezone的修改需要重启数据库才能生效
- time_zone可以设置为以下值： 1.默认本地时区(LOCAL)   2.数据库时区（dbtimezone） 3.时区区域名称（eg.Asia/Hong_kong） 4.时区偏移量（eg.'+08:00'）
- time_zone 时区偏移量取值范围 -15:59 ~ +15:00
|按时区偏移量去设置时区时，oracle规则如下：    
  1、'+-'号可以省略,2、时跟分必须同时出现，且分隔符必须是冒号':'  （分隔符是否需要对齐）,3、时分的范围是：  -15:59 ~ +15:00,4、  （按严格匹配，先校验长度，再转换）  时跟分匹配时，前面可以出现多个0，如009  （不一致，yashan目前按字符串长度先校验）,5、  （按严格匹配，先校验长度，再转换）  时跟分匹配完成后，后面可以多个无用格式符，如：  （不建议对齐，yashan会将冒号后面直接转数值，然后报错）,alter session set time_zone='9:1我';    
  alter session set time_zone='009:001–';,  
|
|会话级|alter session set time_zone = '+08:00';    
  alter session SET TIME_ZONE=local;  **(local采用操作系统时区)**    
  alter session SET TIME_ZONE=dbtimezone;  **(数据库时区)**    
  alter session SET TIME_ZONE='Asia/Hong_Kong';|继承操作系统时间、时区|select sessiontimezone from dual;|||
|环境变量设置  （不做）|ORA_TZFILE: 指定客户端和服务端的时区,ORA_SDTZ：指定默认的会话时区|  
|  
|||


  


### 4、时区相关format名称含义：    [https://github.com/eggert/tz](https://github.com/eggert/tz)  

###     各地域对应tz offset见-    [TIME_ZONE调研文档](/pages/createpage.action?spaceKey=YASDOC&title=TIME_ZONE%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3&linkCreation=true&fromPageId=177848227)  

|名称|全称|含义|使用|
|---|---|---|---|
|TZH|time zone hour|时区小时。,示例:       `'HH:MI:SS.FFTZH:TZM'`  |可以单独设置，无需与TZM绑定|
|TZM|time zone minute|时区分钟。,示例:       `'HH:MI:SS.FFTZH:TZM'`    .|可以单独设置，无需与TZH绑定|
|TZR  （不做）|time zone region|时区信息. 必须是在数据库里的时区名。 ,示例:     US/Pacific， ASIA/shanghai,全球TZR与TZ offset对应表  ：    [https://cloud.tencent.com/developer/article/1778546](https://cloud.tencent.com/developer/article/1778546)  |可以单独设置,oracle查询语句（2341个）：,SELECT TZNAME, TZABBREV FROM V$TIMEZONE_NAMES ORDER BY TZNAME, TZABBREV;,查不重复的（591个）：,SELECT UNIQUE TZNAME FROM V$TIMEZONE_NAMES;,oracle支持的TZR  ：    [TZR(oracle)](https://docs.oracle.com/en/database/oracle/oracle-database/21/nlspg/appendix-A-locale-data.html#GUID-21D14370-A707-4482-A3FE-9277263F292A)  |
|TZD  （不做）|time zone daylight|夏令时信息. 是带夏令时信息的时区. 必须于与TZR相对应. ,示例:       `PST`       (for US/Pacific standard time);   ,  `PDT`       (for US/Pacific daylight time).,  [https://www.timeanddate.com/time/zones/](https://www.timeanddate.com/time/zones/)  |可以单独设置,  
|
|（不做）|TIMEZONE ABBR|根据英文单词缩写表示对应时区，如CST：china standard time或central standard time等（一个缩写对应多个时区，如何区分？）    
    [https://www.timeanddate.com/time/zones/](https://www.timeanddate.com/time/zones/)  |1、设置为TZR时显示缩写,2、设置为TZH或TZM时，会将缩写转成对应的TZH:TZM，然后按显示对应格式符的值|
|UTC|universal time coordinated|协调世界时，全世界通用；,计算本地时间时会在utc + 当前时区,获取utc时间底层接口：time(*),获取本地时间底层接口：localTime(*)|  
|


### 5、时区运算矩阵：

**1、除绿色标出之外，其余跟timestamp一致**

**2、空白表示不支持运算**

- **+-运算**


|参数1(y轴)\参数2(x轴)\(返回值类型)|date|timstamp|timestamp tz    
  (  直接使用值运算，不做任何转换  )|timestamp local tz（  转成以session时区为准的数值再运算  ）|dsinterval|yminterval|time|字符串|数值类型|
|---|---|---|---|---|---|---|---|---|---|
|date|-(number)|-（dsinterval）|-（dsinterval）|-（dsinterval）|+-(date)|+-(date)|+-(timestamp)|+-(date)|+-(date)|
|timestamp|-(dsinterval)|-(dsinterval)|-（dsinterval）|-（dsinterval）|+-(timestamp)|+-(timestamp)|+-(timestamp)|+-(date)|+-(date)|
|timestamp tz|-(dsinterval)|-(dsinterval)|-(dsinterval)|-（dsinterval）|+-（timestamp tz）|+-（timestamp tz）|+-（timestamp tz）|+-(date)|+-(date)|
|timestamp local tz|-(dsinterval)|-(dsinterval)|-（dsinterval）|-（dsinterval）|+-（timestamp local tz）|+-（timestamp local tz）|+-（timestamp local tz）|+-(date)|+-(date)|
|dsinterval|+(date)|+(timestamp)|+(timestamp tz)|+(timestamp local tz)|+-(dsinterval)|  
|+(time)|  
|  
|
|yminterval|+(date)|+(timestamp)|+（timestamp tz）|+（timestamp local tz）|  
|+-(yminterval)|  
|  
|  
|
|time|+(timestamp)|+(timestamp)|+（timestamp tz）|+（timestamp local tz）|+-(time)|  
|-(dsinterval)|  
|  
|
|字符串|+(date)|+(date)|+(date)|+(date)|  
|  
|  
|N/A|N/A|
|数值类型|+(date)|+(date)|+(date)|+(date)|  
|  
|  
|N/A|N/A|


- **乘除运算：**


|参数1(y轴)\参数2(x轴)\(返回值类型)|date|timstamp|timestamp tz|timestamp local tz|dsinterval|yminterval|time|字符串|数值类型|
|---|---|---|---|---|---|---|---|---|---|
|date|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|timestamp|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|timestamp tz|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|timestamp local tz|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|dsinterval|  
|  
|  
|  
|  
|  
|  
|*、/(dsinterval)|*、/(dsinterval)|
|yminterval|  
|  
|  
|  
|  
|  
|  
|*、/(yminterval)|*、/(yminterval)|
|time|  
|  
|  
|  
|  
|  
|  
|  
|  
|
|字符串|  
|  
|  
|  
|*(dsinterval)|*(dsinterval)|  
|N/A|N/A|
|数值类型|  
|  
|  
|  
|*(yminterval)|*(yminterval)|  
|N/A|N/A|


  


**6、时区转换矩阵：**

1、tsTz：转成tsLtz，ltz结果为= tz值 + （session时区 - tz时区）； 转成别的类型直接使用ts值，不做任何时区转换

2、tsLtz：先转成以session时区为准的数值，转tsTz还要+ session时区信息

3、字符串转tz，直接转，然后加上session时区信息。转成ltz时，存储的时候先按utc时间，再输出时再按session时间

|(是否支持)|timestamp tz|timestamp local tz|timstamp|date|dsinterval|yminterval|time|字符串|数值类型|
|---|---|---|---|---|---|---|---|---|---|
|timestamp tz|√|√|√|√|  
|  
|√|√|  
|
|timestamp local tz|√|√|√|√|  
|  
|√|√|  
,  
|


  


**7、对关键字影响：**  **（不做）**

|关键字|yashan现有表现|oracle表现|是否需更改|
|---|---|---|---|
|timestamp|后接字符串表示为timestamp类型，,如：timestamp'2012-1-1 1:1:1'|1、可以接'2012-1-1 1:1:1'表明timestamp类型,2、可以接'2012-1-1 1:1:1 +8:00'，'2012-1-1 1:1:1   America/Los_Angeles   [TZD]'等表明为timestamp timezone类型|与oracle对齐？|


  


**8、对系统函数影响：**

|函数|返回类型|实际意义|yashan原先表现|是否需要更改|  
|
|---|---|---|---|---|---|
|localtimestamp|oracle：timestamp    
  mysql：timestamp|返回当前时间，实际结果是utc时间+session时区    
  oracle：  通过alter 设置session时区,mysql：  通过set 来设置时区：, set time_zone='+9:00';, select @@global.time_zone, @@session.time_zone;, show variables like '%time_zone%'；|三个函数都是返回timestamp，并且结果都一致，返回的是操作系统时间,时区用的是操作系统的时区    
    
|与oracle对齐|**外场涉及相关兼容性修改需要对齐影响**|
|current_timestamp|oracle：  ts tz    
  mysql：  ts|返回当前时间，数值结果同localtimestamp，,oracle返回类型时ts tz，因此显示会加上session时区信息||与oracle对齐|  
|
|systimestamp|oracle：ts tz,mysql：无|返回数据库服务器所在操作系统当前的时间信息，时区用的是操作系统的时区，  并非dbTimezone||与oracle对齐|  
|


### 9、AT Time zone 'TZH:TZM'   （不做）

- 该语法返回的是tm Tz类型，时区以at time zone后面的时区显示
- 可以是timestamp、tmTz，tmLtz返回类型（函数、列、timestamp关键字等）后面接该语法，转成tmTz；转换的时候根据不同类型会按sessionTz等做timestamp值的转换


**10、各函数（yashan当前已实现）对时区支持情况**  ：

      见    [timestamp时区类型调研](/pages/createpage.action?spaceKey=YASDOC&title=timestamp%E6%97%B6%E5%8C%BA%E7%B1%BB%E5%9E%8B%E8%B0%83%E7%A0%94&linkCreation=true&fromPageId=177848227)     最后函数支持情况（部分需更新）

**产品给支持列表？（时间 + 数值 + 字符串 + 聚集类型）**

|分类|函数|
|---|---|
|时间函数|CURRENT_TIMESTAMP|
|  
|EXTRACT|
|  
|LAST_DAY|
|  
|MONTHS_BETWEEN|
|  
|SYSDATE|
|  
|SYSTIMESTAMP|
|  
|LOCALTIMESTAMP|
|  
|NEXT_DAY|
|  
|SYS_EXTRACT_UTC|
|数值函数|ROUND|
|  
|TRUNC|
|  
|CONCAT|
|  
|INSTR|
|  
|INSTRB|
|  
|LENGTH/LENGTHB|
|  
|LENGTH2|
|  
|LOWER|
|  
|LPAD|
|字符|LTRIM|
|  
|REPLACE|
|  
|RPAD|
|  
|RTRIM|
|  
|SUBSTR|
|  
|SUBSTRB|
|  
|TRIM|
|  
|UPPER|
|聚集|COUNT|
|  
|MAX|
|  
|MEDIAN|
|  
|MIN|
|转换|CAST|
|  
|SCN_TO_TIMESTAMP|
|  
|TIMESTMAP_TO_SCN|
|  
|TO_CHAR|
|  
|TO_DATE|
|  
|TO_TIMESTAMP|
|其他|LNNVL|
|  
|NULLIF|
|  
|NVL|
|  
|NVL2|
|  
|GET_TYPE_NAME|
|窗口函数|MIN|
|  
|MAX|
|  
|COUNT|
|  
|MEDIAN|


### 11、yashan其余场景支持情况：

|  
|场景|是否需要支持|开发责任人|备注|
|---|---|---|---|---|
|1|客户端|√|徐伟|  
|
|2|驱动(c, jdbc)|√|冯皓博|  
|
|3|批量执行|  
|  
|  
|
|4|导入导出|√（依赖c驱动先适配）|冯皓博|  
|
|5|dblink|  
|  
|  
|
|6|列存，分布式|  
|  
|  
|
|7|存储过程|√|  
|  
|
|8|高级包|  
|  
|需排查禁掉|


**参考文档：**

  [添加新数据类型——简单指导文档](https://conf.yasdb.com/pages/viewpage.action?pageId=100093011)  

  [date type(oracle)](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/Data-Types.html#GUID-BE23545B-469A-4A57-8D13-505F2F5DB706)  

  [datatime data type(oracle)](https://docs.oracle.com/en/database/oracle/oracle-database/21/nlspg/datetime-data-types-and-time-zone-support.html#GUID-773BD5B5-D6AD-4AF6-B38B-EBD1459C8445)  

  [alter time_zone(oracle)](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/ALTER-SESSION.html#GUID-27186B28-7EFC-4998-B1ED-2B905CC0211B)  

  [Oracle 时区详解_夜光小兔纸的博客-CSDN博客](https://blog.csdn.net/Ruishine/article/details/132492107?ops_request_misc=%257B%2522request%255Fid%2522%253A%2522169560675316800182174175%2522%252C%2522scm%2522%253A%252220140713.130102334..%2522%257D&request_id=169560675316800182174175&biz_id=0&utm_medium=distribute.pc_search_result.none-task-blog-2~all~baidu_landing_v2~default-2-132492107-null-null.142^v94^insert_down1&utm_term=oracle%20%E6%97%B6%E5%8C%BA&spm=1018.2226.3001.4449)  

## Attachments:

[image2024-10-17_10-13-52.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWJhMWFkOWEzMzExZGM5YWNkIiwicmVmX2lkIjoiNjczOTZlZWE3MjgyMDZlZmI5MmYyZTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MDcyLCJleHAiOjE3ODI1NDE0NzJ9.3gpdMB6RTs2_iHigtzaKaG5xlFmSbL5_y-gyLi6UL7U)

 (image/png)    


[image2024-10-17_10-13-26.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlZWI4OTcwYzJhZjRmNTIxYzVjIiwicmVmX2lkIjoiNjczOTZlZWE3MjgyMDZlZmI5MmYyZTQ3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU1MDcyLCJleHAiOjE3ODI1NDE0NzJ9.6gdScSPr98iJCc22RuF5HjsK-KrNQaHSwj-gOnRYxFU)

 (image/png)    
