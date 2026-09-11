Created by 王林, last modified by  何阳 on 十月 19, 2024

*SR链接：*  *YDBRD-20472 *    [支持LBAC的标签转换能力函数](https://pingcode.yasdb.com/pjm/items/661165e6579a3edb84d6e34d?%20#YDBRD-20472%20%E6%94%AF%E6%8C%81LBAC%E7%9A%84%E6%A0%87%E7%AD%BE%E8%BD%AC%E6%8D%A2%E8%83%BD%E5%8A%9B%E5%87%BD%E6%95%B0)  

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

    YashanDB Label Security，通过Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

通过函数LABEL_TO_CHAR, CHAR_TO_LABEL提供标签值和标签内容之间的转换，通过高级包 LBAC$SA_LABELS下FROM_LABEL函数根据给定策略的LEVEL,COMPARTMENT, GROUP的值组成的字符串，返回对应的LEVEL,COMPARTMENT, GROUP的名字组成的字符串 

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

       LBAC 行访问控制功能需求，用来查看标签具体内容。

    用户可以通过LABEL_TO_CHAR查看给定的标签值对应的标签内容，在对标签列插入数值时可以根据标签字符串信息转化为标签值，在查看用户对应的标签信息时，可以使用  LBAC$SA_LABELS下FROM_LABEL查看具体的标签字符串内容。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

<<label-security-administrators-guide>> 中 “Conversion of a Label Tag to a Character String, with LABEL_TO_CHAR“ 章节，

“Converting a Character String to a Label Tag with CHAR_TO_LABEL”章节。

高级包  LBAC$SA_LABELS     [https://www.morganslibrary.org/reference/pkgs/lbac$sa_labels.html](https://www.morganslibrary.org/reference/pkgs/lbac$sa_labels.html)    。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|:---|:---|:---|:---|:---|:---|
|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|功能|LABEL_TO_CHAR|新增内置函数，读取yls$lab, 根据标签值返回标签内容,FUNCTION LABEL_TO_CHAR (,    label IN BIGINT),RETURN VARCHAR;|是|否|----|
|  
|CHAR_TO_LABEL|新增内置函数，读取yls$lab, 根据标签内容返回标签值,FUNCTION CHAR_TO_LABEL (,    policy_name IN VARCHAR,,    label_string IN VARCHAR),RETURN BIGINT;|是|否|----|
|  
|LBAC$SA_LABELS.FROM_LABEL|使用高级包框架实现内置高级包  LBAC$SA_LABELS，,在LBAC$SA_LABELS中添加函数FROM_LABEL,FUNCTION FROM_LABEL (,    ILABEL  VARCHAR),RETURN VARCHAR;|是|否|  
|
|性能|性能场景1|----|否|否|----|
|  
|性能场景2|----|否|否|----|
|可用性|恢复场景|----|否|否|----|
|可靠性|故障场景|----|否|否|----|
|可维可测|DFX功能1|----|否|否|----|
|  
|DFX功能2|----|否|否|----|
|安全|安全场景1|----|否|否|----|
|易用性|----|----|否|否|----|
|可修改性|----|----|否|否|----|
|兼容性|----|----|否|否|----|
|周边配合|权限|LABEL_TO_CHAR,   CHAR_TO_LABEL 为系统函数，不需要额外添加权限处理，,LBAC$SA_LABELS.FROM_LABEL 不需要设置权限即可执行。|否|否|----|
|周边配合|审计|----|----|否|----|
|周边配合|导入导出工具|----|----|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无，不需要添加元数据信息

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

//给定标签值返回标签字符串内容

ankGetLbacSlabelByTag(AnkHandler* handler, CodUint64 labelTag);

  


//给定标签字符串内容返回标签值

ankGetLbacLabelTagByStr(AnkHandler* handler, CodText* plyName, CodText* slabel);

  


//给定策略id、标签对应的level, compartments, groups信息返回标签字符串内容

ankGetLbacSlabelByIlabel(AnkHandler* handler, CodText* ilabel);

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

无

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

通过系统函数实现LABEL_TO_STR, STR_TO_LABEL；通过以高级包  LBAC$SA_LABELS下的函数形式来实现LBAC$SA_LABELS.FROM_LABEL。

###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

#### 4.1.1 函数  LABEL_TO_CHAR

LABEL_TO_CHAR 根据给定的标签值返回标签内容。

在视图DBA_SA_LABELS中，查看标签列LABEL_TAG对应的行内容，返回LABEL列对应的内容。

```
FUNCTION LABEL_TO_CHAR (

    label IN BIGINT)

RETURN VARCHAR;
```

  
     label : 标签值  参数说明：

  


结果说明：

（1）当标签值存在时，返回标签内容字符串；

（2）当标签值不存在时， 报错invalid label string。

  


**权限**

不需要额外添加权限即可运行。

#### 4.1.2 函数  CHAR_TO_LABEL

CHAR_TO_LABEL 跟定 给定的标签内容字符串返回标签值。

在视图DBA_SA_LABELS中，查看标签内容列LABEL对应的行，返回LABEL_TAG对应的内容。若标签内容字符串合法但是不在视图DBA_SA_LABELS中存在，则会自动生成对应的标签。

  


函数定义

```
FUNCTION CHAR_TO_LABEL (
 
    policy_name IN VARCHAR,
 
    label_string IN VARCHAR)
 
RETURN BIGINT;
```

  


参数说明：

    policy_name :  策略名，大小写不敏感。

    label_string： 标签内容字符串，大小写不敏感。

  


结果说明：

（1）给定的策略名及标签内容字符串存在，则返回标签值。

（2）若策略名不存在，报错 policy p11 not found。

（3）若标签内容字符串的组成非法，报 invalid label string:xxx。

（4）若标签内容合法，范围的组成内容成员的重复、次序不影响获取标签值。

（4）在select 查询中，若标签内容字符串不存在，则会新创建个label，label_tag自动生成（取自序列YLS$LAB_SEQUENCE.nextval），LABEL_TYPE 对应 USER LABEL 。

         在insert 语句中，作为标签列值输入，受用户标签值影响。

    （1）若标签内容字符串不存在则报错；

    （2）若标签内容字符串存在但是类型不为 USER/DATA LABEL， 则报错：ORA-12406: 未经策略 P1 授权的 SQL 语句。

    （3）若插入的值根据用户上挂载的标签信息，经计算若不是可写（）的数据则报错。ORA-12406: 未经策略 P1 授权的 SQL 语句。

  


**权限**

不需要额外添加权限即可运行。

#### 4.1.3 函数  LBAC$SA_LABELS.FROM_LABEL

通过高级包LBAC$SA_LABELS提供的函数FROM_LABEL将 策略id及级别、范围、组的值组成的字符串内容转化为标签字符串内容。

函数定义

```
FUNCTION FROM_LABEL(
  
    ilabel  IN VARCHAR)
  
RETURN VARCHAR;
```

  
  组成内容说明：

![](https://pingcode.yasdb.com/atlas/files/public/67396d788970c2af4f5212de/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1NjQsImV4cCI6MTc4MjMxOTM2NH0.AVIyVnOsALWi5JNwl58JT5C2hestirx5QTBgqSphvHM)

ilabel 格式如下：

policyId 为策略值对应的字符串，长度20字节，数值不够会补‘0’。

组合标识：长度2字节，包括如下：10 -- 只含有level； 11 -- 含有level, compartment； 12 -- 含有level和group ；13 -- 含有level、compartment和group.

等级值：数值字符串，长度4字节。

‘.’ 间隔符，不可省略。

compValue和 groupValue值前后用 ‘%’做间隔。

  


在oracle上测试：组合标识 内容不影响执行结果。

  


**权限**

不需要额外添加权限即可运行。

  


###   [4.3 特性性能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)  

无

###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

无

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

char_to_label 在select查询时会向label系统表中插入数据，同时生成label对应的entry，这个label可以正常删除。

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

无

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
--testcase1
create user lbacsys identified by lbacsys;
grant dba to lbacsys;
grant lbac_dba to lbacsys;
 
conn lbacsys/lbacsys@127.0.0.1:1688
call yls_enforcement.enable_yls;
call sa_sysdba.create_policy ('p1', 'p1_column');
--level
call sa_components.create_level ( 'p1', 10, 'gen', 'gen');
call sa_components.create_level ( 'p1', 20, 'mid', 'mid');
call sa_components.create_level ( 'p1', 30, 'high', 'high');
--compartments
call sa_components.create_compartment ( 'p1', 10, 'part1', 'part1');
call sa_components.create_compartment ( 'p1', 20, 'part2', 'part2');
call sa_components.create_compartment ( 'p1', 30, 'part3', 'part3');
--labels
call sa_label_admin.create_label ('p1', 1001, 'gen');
call sa_label_admin.create_label ('p1', 1002, 'mid:part1');
 
--label to char
select label_to_char(1001) from dual;
select label_to_char(1002) from dual;
select label_to_char(0) from dual;
 
--char to label
select char_to_label('gen') from dual;
select char_to_label('mid:part1') from dual;
select char_to_label('mid:part1,') from dual;
select char_to_label('mid:part1.') from dual;
select char_to_label('mid:part1,:') from dual;
select char_to_label('mid:part1:') from dual;
select char_to_label('gen:part1') from dual;
select char_to_label('gen:' || RPAD('part1,', 6*665, 'part2,') || 'part3')  from dual;
select * from dba_sa_labels where policy_name ='P1' order by label asc;
 
--lbac$sa_labels下from_label
select lbac$sa_labels下from_label(ilabel) from sys.yls$lab where POL# in (select obj# from sys.obj$ where name = 'P1');
select lbac$sa_labels下from_label('') from dual;
select lbac$sa_labels下from_label('00000000000000002425100010..') from dual;
select lbac$sa_labels下from_label('00000000000000002425100010.') from dual;
```

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

高级包：LBAC$SA_LABELS

内置函数：LABEL_TO_CHAR, CHAR_TO_LABEL

  


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

  


## Attachments: