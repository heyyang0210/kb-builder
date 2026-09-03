

SR链接：  [https://pingcode.yasdb.com/pjm/items/670e3cb2e489dd0868f7e606?](https://pingcode.yasdb.com/pjm/items/670e3cb2e489dd0868f7e606?)  

#YDBRD-34249 【mysql兼容】兼容与MYSQL同名字符串查找函数规格

#   [1. Overview（概述）](#1-overview概述)  

函数的语法、功能调研基于MYSQL 5.7。

友商文档：

  [https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_substring](https://dev.mysql.com/doc/refman/5.7/en/string-functions.html#function_substring)  

#   [2. Features（功能特性）](#2-features功能特性)  

(1) 功能按等价类划分子特性，将每个子特性对应的输出行为，尝试进行行为解释说明。等价类划分要证明全面。

|功能|调研表现|
|---|---|
|FIND_IN_SET|返回目标字符串在源字符串列表中的位置|
|INSTR|返回子串在字符串中出现的位置。|
|POSITION|在源字符串中查找目标字符串，返回第一次出现目标字符串的位置|
|SUBSTR|返回字符串子串|
|SUBSTRING|返回字符串子串|
|SUBSTRING_INDEX|返回在源字符串中出现定界符位置之前的子串|


(2) 函数或者表达式特性调研，必须给出不同参数组合情况下，功能特性的表现情况。同时因为与数据类型相关，要组合不同数据类型入参下，计划和执行阶段出参的类型。

##   [2.1 FINDE_IN_SET](#21-lcase)  

FIND_IN_SET(str, strList)：

返回目标字符串在源字符串列表中的位置，源字符串列表用英文逗号（,）隔开。

1）两个参数，均为字符串类型或可转换为字符串类型；

2）返回类型为int；

drop table if exists find_in_set_func_t1;

create table find_in_set_func_t1 as select find_in_set('b123', 'a,c,dafd,b123,58347') from dual;

desc find_in_set_func_t1;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871002a1ad9a3311de6a7c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)

### 

drop table if exists find_in_set_func_t2;

create table find_in_set_func_t2(c1 varchar(8000));

insert into find_in_set_func_t2 values(lpad(rpad('a', 2000, 'cde'), 7000, 'ba,,,,,,,bbc,c,b123'));



drop view if exists find_in_set_func_v1;

create view find_in_set_func_v1 as select find_in_set('b123', c1) from find_in_set_func_t2;

desc find_in_set_func_v1;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678710afa1ad9a3311de6a7e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



3）字符串类型大小写不敏感，二进制类型大小写敏感；

select find_in_set('aaa', 'a,c,dafd,AAA,aaa') from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871169a1ad9a3311de6a82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)

drop table if exists find_in_set_func_t3;

create table find_in_set_func_t3(cb blob);



insert into find_in_set_func_t3 values('a,c,dafd,AAA,aaa');

select find_in_set('aaa', cb) from find_in_set_func_t3;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678711c3a1ad9a3311de6a83/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



4）任意一个参数为null，返回null；

select find_in_set('aaa', null) from dual;

select find_in_set(null, 'a,bc,d') from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871221a1ad9a3311de6a84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



5）位置计算从1开始，返回1到N，未找到返回0；strList为空串返回0；

select find_in_set('aaa', '') from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/6787129aa1ad9a3311de6a85/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



6）若str中包含‘,’，函数将不能保证返回结果的正确性；

7）str为空串，可以正常匹配

select find_in_set('', ' ,, ') from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871323a1ad9a3311de6a88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



8）mysql char类型存表会截断尾部空格，使用find_in_set函数返回结果与直接输入返回结果不同

select find_in_set('  ', ', ,  ') from dual;



drop table if exists find_in_set_func_t1;  
create table find_in_set_func_t1(c1 char(5));
insert into find_in_set_func_t1 values('    ');
select length(c1) from find_in_set_func_t1;
truncate table find_in_set_func_t1;
insert into find_in_set_func_t1 values(', ,  ');
select find_in_set('  ', c1) from find_in_set_func_t1;
drop table find_in_set_func_t1;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678dfad0a1ad9a3311de6ea4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



##   [2.2 INSTR](#22-json-extract)  

INSTR(str, substr)

在源字符串中查找目标字符串，返回第一次出现目标字符串的位置。格式为instr(str, substr)。

与LOCATE(substr, str)函数功能相同，只是参数位置不同。

1）两个参数均为字符串类型或可以转换为字符串的类型；

2）返回bigint类型；

drop view if exists find_instr_func_v1;

create view find_instr_func_v1 as select instr('cdeadfffff', 'ead') from dual;

desc find_instr_func_v1;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871bb9a1ad9a3311de6aa3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



3）任意参数为null，返回null；

select instr('foobarbar', null);

select instr(null, 'bar');

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871c43a1ad9a3311de6aa5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



4）mysql字符串大小写不敏感，但二进制类型敏感；

5）空串可以是任意字符串的子串；

select instr('foobarbar', '');

select instr('', '');

![image.png](https://pingcode.yasdb.com/atlas/files/public/67871d3ba1ad9a3311de6aaa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



##   [2.3 POSITION](#22-json-extract)  

在源字符串中查找目标字符串，返回第一次出现目标字符串的位置。格式为 position(substr IN sr)。

与LOCATE(substr, str)，INSTR(str, substr)函数功能相同。



##   [2.4 SBUSTR](#22-json-extract)  

返回字符串子串。与SUBSTRING函数功能相同。



##   [2.5 SUBSTRING](#22-json-extract)  

返回字符串子串。包括四种格式：

substring(str,pos)

substring(str from pos)

substring(str,pos,len)

substring(str from pos for len)

1）pos表示位置，从1开始；若为负值，表示从结尾反向位置；len表示子串长度；若省略，则截取最大长度。

select substring('quadratically',5) from dual;

select substring('quadratically', -5) from dual;

select substring('quadratically' from -5) from dual;

select substring('quadratically' from -5 for 3) from dual;

2）任意参数为null，则返回null；

select substring(null from -5 for -1) from dual;

select substring('quadratically' from null) from dual;

select substring('quadratically' from 2 for null) from dual;

select substring('quadratically', null, 8) from dual;

select substring('quadratically', 5, null) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678720ada1ad9a3311de6ab3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



3）若str为空串则返回空串

select substring('',500, 2) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67872114a1ad9a3311de6ab5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



4）若pos位置不正确，则返回空串；

select substring('quadratically', 10000) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67872273a1ad9a3311de6ab8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



5）若len小于1，返回空串；

select substring('quadratically', 2, 0) from dual;

select substring('quadratically', 2, -100000000000000000000) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678722e9a1ad9a3311de6ab9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



6）若len超过实际能截取的长度，则按最大长度截取；

7）pos，len类型为bigint；

select substring('abcde1111ac', 18446744073709551615, 18446744073709551615) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67872470a1ad9a3311de6ac1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



8）浮点类型转为bigint规则为奇进偶舍，带有小数的NUMBER类型转为bigint类型将四舍五入取整

转换舍入规则参考：

  [https://dev.mysql.com/doc/refman/5.7/en/mathematical-functions.html#function_round](https://dev.mysql.com/doc/refman/5.7/en/mathematical-functions.html#function_round)  

![image.png](https://pingcode.yasdb.com/atlas/files/public/6789ff1ca1ad9a3311de6d37/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



drop table if exists my_substr_t1;

create table my_substr_t1(c1 float, c2 double, c3 decimal(5, 2), c4 varchar(10));

insert into my_substr_t1 values(3.5, 3.5, 3.5, 3.5);

insert into my_substr_t1 values(0.5, 0.5, 0.5, 0.5);

select * from my_substr_t1;

select substr('abcde1111ac', c1), substring('abcde1111ac', c2), substring('abcde1111ac', c3), substring('abcde1111ac', c4) from my_substr_t1;

![image.png](https://pingcode.yasdb.com/atlas/files/public/6789fd8da1ad9a3311de6d30/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



9）返回类型

str为char，varchar，nchar，nvarchar 返回varchar；

str为blob，返回blob；为biinary，varbinary返回varbinary；

str为bit类型，返回varbinary类型；



drop table if exists my_substr_t2;

create table my_substr_t2(c1 blob, c2 varbinary(30), c3 binary(20), c4 char(20), c5 nchar(20), c6 nvarchar(20), c7 bit(10));

drop table if exists my_substr_t2_02;

create table my_substr_t2_02 as select substring(c1, 1) from my_substr_t2;

desc my_substr_t2_02;

drop table if exists my_substr_t2_02;

create table my_substr_t2_02 as select substring(c7, 1) from my_substr_t2;

desc my_substr_t2_02;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678726d1a1ad9a3311de6ac5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)





##   [2.6 SUBSTRING_INEX](#22-json-extract)  

返回在源字符串中出现第count次定界符位置之前的子串，格式为 substring_index(str,delim,count)。

1）str为字符串或能转换为字符串的表达式；

2）delim类型为字符串或能转换为字符串的表达式；

3）count表示定界符出现次数，正数表示从左计数，负数表示从右计数；类型为BIGINT；浮点类型奇进偶舍，带有小数的NUMBER类型将四舍五入取整；

select substring_index('abcefffeff', 'e', 2) from dual;

select substring_index('abcefffeff', 'e', -2) from dual;

select substring_index('abcefffeff', 'e', 18446744073709551615) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/6787291ea1ad9a3311de6ac9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



4）大小写敏感

select substring_index('abcefEffefEf', 'e', 2) from dual;

select substring_index('abcefEffefEf', 'E', 2) from dual;

select substring_index('abcefEffefEf', 'E', -2) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678729a2a1ad9a3311de6acb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



5）任意参数为null则返回null；

select substring_index('abcefEffefEf', null, 2) from dual;

select substring_index(null, 'a', 2) from dual;

select substring_index('abcefEffefEf', 'E', null) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678729e5a1ad9a3311de6acd/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



6）str或delim为空串则返回空串，count输入0返回空串；

select substring_index('abcefEffefEf', '', 2) from dual;

select substring_index('', 'e', 2) from dual;

select substring_index('abcefEffefEf', 'E', 0) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67906ba798ac295b69be0a3a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



7）若输入计数值大于实际出现次数或定界符不存在，则返回整体str；

select substring_index('abcefEffefEf', 'E', 200) from dual;

select substring_index('abcefEffefEf', 'E', -200) from dual;

select substring_index('abcefEffefEf', '.', 200) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/67872a99a1ad9a3311de6acf/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



8）小数转字符串结果影响函数结果

select substring_index('abcef0.5ddddd0.5', 0.5, 2) from dual;

![image.png](https://pingcode.yasdb.com/atlas/files/public/678f0388a1ad9a3311de6f31/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)

崖山转换对于 -1,1之间的小数转换为字符串，会省略0

![image.png](https://pingcode.yasdb.com/atlas/files/public/678f03bda1ad9a3311de6f32/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRkFSRUFBQVFBQWdBQ0FBSUlBQUVBbUFnQVVBQ0lDQUFDZ0FBQWdBSlJCZ0NnQ0JDQVlBRWdBQUFFQUxCQWdRQUZBUUVFSUFoQUpBZ0FVUU1BQUFJS0FBQ0NBd1FBRUFBQUJXUUFFQUlCSUFCTU9kQUFCRUlBQVFRQUFFZ2tBS0lBZ0FBQUNBQUFRREFBUUVDQWdJQUFBQVJKQ0FBQUFTQUFBQUFna0VVQUNBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTYyMjYsImV4cCI6MTc4MjQ2NzAyNn0.zjvk0SxutJgjc6rY67_q4RtUf7Mdflqg9yfLk0XVBFk)



9）返回类型

str为char，varchar，nchar，nvarchar 返回varchar；

str为blob，返回blob；为biinary，varbinary返回varbinary；

str为bit类型，返回varbinary类型；





##   [3. Specification And Constraints（规格与约束）](#3-specification-and-constraints规格与约束)  

说明整个特性或子特性，在对应数据库下，调研得到的功能限制或约束。

##   [4. Dependency（功能依赖）](#4-dependency功能依赖)  

说明整个特性或子特性，在对应数据库下，调研得到的功能对第三方件的依赖，开源协议。

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*