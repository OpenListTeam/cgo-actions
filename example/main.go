package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/mattn/go-sqlite3"
)

var (
	owner      string
	repo       string
	target     string
	sha        string
	short_sha  string
	pr         string
	ext        string
	tag        string
	hostname   string
	username   string
	built_on   string
	built_at   string
	git_author string
	git_commit string
	go_version string
)

func main() {
	fmt.Printf("owner: %s\n", owner)
	fmt.Printf("repo: %s\n", repo)
	fmt.Printf("target: %s\n", target)
	fmt.Printf("sha: %s\n", sha)
	fmt.Printf("short_sha: %s\n", short_sha)
	fmt.Printf("pr: %s\n", pr)
	fmt.Printf("ext: %s\n", ext)
	fmt.Printf("tag: %s\n", tag)
	fmt.Printf("hostname: %s\n", hostname)
	fmt.Printf("username: %s\n", username)
	fmt.Printf("built_on: %s\n", built_on)
	fmt.Printf("built_at: %s\n", built_at)
	fmt.Printf("git_author: %s\n", git_author)
	fmt.Printf("git_commit: %s\n", git_commit)
	fmt.Printf("go_version: %s\n", go_version)
	os.Remove("./foo.db")

	db, err := sql.Open("sqlite3", "./foo.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	sqlStmt := `
	create table foo (id integer not null primary key, name text);
	delete from foo;
	`
	_, err = db.Exec(sqlStmt)
	if err != nil {
		log.Printf("%q: %s\n", err, sqlStmt)
		return
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	stmt, err := tx.Prepare("insert into foo(id, name) values(?, ?)")
	if err != nil {
		log.Fatal(err)
	}
	defer stmt.Close()
	for i := 0; i < 100; i++ {
		_, err = stmt.Exec(i, fmt.Sprintf("こんにちは世界%03d", i))
		if err != nil {
			log.Fatal(err)
		}
	}
	err = tx.Commit()
	if err != nil {
		log.Fatal(err)
	}

	rows, err := db.Query("select id, name from foo")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id int
		var name string
		err = rows.Scan(&id, &name)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(id, name)
	}
	err = rows.Err()
	if err != nil {
		log.Fatal(err)
	}

	stmt, err = db.Prepare("select name from foo where id = ?")
	if err != nil {
		log.Fatal(err)
	}
	defer stmt.Close()
	var name string
	err = stmt.QueryRow("3").Scan(&name)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(name)

	_, err = db.Exec("delete from foo")
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec("insert into foo(id, name) values(1, 'foo'), (2, 'bar'), (3, 'baz')")
	if err != nil {
		log.Fatal(err)
	}

	rows, err = db.Query("select id, name from foo")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()
	for rows.Next() {
		var id int
		var name string
		err = rows.Scan(&id, &name)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(id, name)
	}
	err = rows.Err()
	if err != nil {
		log.Fatal(err)
	}
}
